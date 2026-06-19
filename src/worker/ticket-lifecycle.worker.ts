import { db } from "@/db";
import { ticketEvents, tickets } from "@/db/schema/tickets";
import { TICKET_LIFECYCLE_JOBS, type TicketLifecycleJob } from "@/lib/queue";
import { calculateSlaWarningAt } from "@/services/ticket-sla.service";
import { closeResolvedTicket } from "@/services/ticket-lifecycle.service";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { Worker, type ConnectionOptions, type JobsOptions } from "bullmq";
import { WORKER_TUNING } from "./worker-tuning";

export function createTicketLifecycleWorker(connection: ConnectionOptions) {
  return new Worker<TicketLifecycleJob>(
    "ticket-lifecycle",
    async (job) => {
      if (job.name === TICKET_LIFECYCLE_JOBS.autoCloseResolved) {
        return autoCloseResolvedTickets();
      }
      if (job.name === TICKET_LIFECYCLE_JOBS.scanTicketSlas) {
        return scanTicketSlas();
      }
      throw new Error(`Unknown ticket lifecycle job: ${job.name}`);
    },
    { connection, concurrency: 1, ...WORKER_TUNING },
  );
}

async function autoCloseResolvedTickets() {
  const dueTickets = await db.query.tickets.findMany({
    where: and(
      eq(tickets.status, "resolved"),
      lte(tickets.autoCloseDueAt, new Date()),
    ),
    columns: { id: true },
  });

  for (const ticket of dueTickets) {
    await closeResolvedTicket({
      ticketId: ticket.id,
      actorId: null,
      actorType: "system",
      closeType: "auto_close",
    });
  }

  return { closed: dueTickets.length };
}

async function scanTicketSlas() {
  const now = new Date();
  const activeTickets = await db.query.tickets.findMany({
    where: inArray(tickets.status, ["open", "in_progress"]),
    columns: {
      id: true,
      createdAt: true,
      firstResponseDueAt: true,
      firstRespondedAt: true,
      firstResponseSlaStatus: true,
      resolutionDueAt: true,
      resolutionSlaStatus: true,
    },
  });

  let updated = 0;
  for (const ticket of activeTickets) {
    if (
      !ticket.firstRespondedAt &&
      ticket.firstResponseDueAt &&
      ticket.firstResponseSlaStatus !== "breached"
    ) {
      const status =
        ticket.firstResponseDueAt <= now
          ? "breached"
          : calculateSlaWarningAt(ticket.createdAt, ticket.firstResponseDueAt) <= now
            ? "warning"
            : ticket.firstResponseSlaStatus;
      if (status !== ticket.firstResponseSlaStatus) {
        await updateSlaStatus(ticket.id, "first_response", status);
        updated++;
      }
    }

    if (
      ticket.resolutionDueAt &&
      ticket.resolutionSlaStatus !== "breached"
    ) {
      const status =
        ticket.resolutionDueAt <= now
          ? "breached"
          : calculateSlaWarningAt(ticket.createdAt, ticket.resolutionDueAt) <= now
            ? "warning"
            : ticket.resolutionSlaStatus;
      if (status !== ticket.resolutionSlaStatus) {
        await updateSlaStatus(ticket.id, "resolution", status);
        updated++;
      }
    }
  }

  return { updated };
}

async function updateSlaStatus(
  ticketId: string,
  timer: "first_response" | "resolution",
  status: "warning" | "breached" | "safe",
) {
  const eventType = status === "breached" ? "sla_breached" : "sla_warning";
  const updates =
    timer === "first_response"
      ? { firstResponseSlaStatus: status, updatedAt: new Date() }
      : {
          resolutionSlaStatus: status,
          slaStatus: status,
          updatedAt: new Date(),
        };

  await db.transaction(async (tx) => {
    const existing = await tx.query.ticketEvents.findFirst({
      where: and(
        eq(ticketEvents.ticketId, ticketId),
        eq(ticketEvents.type, eventType),
        eq(ticketEvents.slaTimer, timer),
      ),
      columns: { id: true },
    });
    if (existing) return;

    await tx.update(tickets).set(updates).where(eq(tickets.id, ticketId));
    await tx.insert(ticketEvents).values({
      ticketId,
      type: eventType,
      actorId: null,
      actorType: "system",
      slaTimer: timer,
    });
  });
}
