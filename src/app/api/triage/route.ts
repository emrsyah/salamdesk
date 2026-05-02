import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { aiTriageQueue } from "@/lib/queue";
import { z } from "zod";

const BodySchema = z.object({
  ticketId: z.string().min(1),
});

/**
 * POST /api/triage
 * Manually trigger AI triage on an existing ticket.
 * Useful for re-triaging after KB articles are added, or for testing.
 *
 * Body: { ticketId: string }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
  }

  await aiTriageQueue.add("triage", { ticketId: parsed.data.ticketId });

  return NextResponse.json({ queued: true, ticketId: parsed.data.ticketId });
}
