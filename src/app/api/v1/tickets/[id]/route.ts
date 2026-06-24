import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys/api-keys.service";
import { db } from "@/db";
import { tickets } from "@/db/schema/tickets";
import { modules } from "@/db/schema/modules";
import { requesters } from "@/db/schema/requesters";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";
import { withAxiom } from "@/lib/axiom/server";

const xlog = log("api:tickets-detail");

async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  return await validateApiKey(token);
}

export const GET = withAxiom(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const isAuthorized = await verifyAuth(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const ticketId = resolvedParams.id;

    const [ticket] = await db.select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      moduleName: modules.name,
      requesterName: requesters.displayName,
      requesterEmail: requesters.primaryEmail,
      requesterPhone: requesters.primaryPhone,
    })
    .from(tickets)
    .leftJoin(modules, eq(tickets.moduleId, modules.id))
    .leftJoin(requesters, eq(tickets.requesterId, requesters.id))
    .where(eq(tickets.id, ticketId));

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    xlog.error({ err: error }, "get ticket failed");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
