import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys/api-keys.service";
import {
  addRequesterMessageWithLifecycle,
  addSystemUpdateCommand,
  TicketLifecycleError,
} from "@/services/ticket-lifecycle.service";
import { log } from "@/lib/logger";

const xlog = log("api:tickets-messages");

async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  return await validateApiKey(token);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isAuthorized = await verifyAuth(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const ticketId = resolvedParams.id;
    const body = await req.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: "Missing required field: content" }, { status: 400 });
    }

    const senderType = body.senderType === "requester" ? "requester" : "system";
    if (senderType === "requester") {
      const message = await addRequesterMessageWithLifecycle({
        ticketId,
        content,
        source: "api",
      });
      return NextResponse.json({ success: true, message }, { status: 201 });
    }

    const newMessage = await addSystemUpdateCommand({
      ticketId,
      content,
      source: "api",
    });

    return NextResponse.json({ success: true, message: newMessage }, { status: 201 });
  } catch (error: unknown) {
    xlog.error({ err: error }, "post message failed");
    if (error instanceof TicketLifecycleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
