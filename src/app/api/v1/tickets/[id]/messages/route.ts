import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys/api-keys.service";
import { db } from "@/db";
import { tickets, ticketMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

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

    // Verify ticket exists
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Insert message from the API (senderId is null, but senderType is "system" or maybe "user" if we pass email)
    // For simplicity, we'll assume messages created via API are from the system/API unless specified.
    // If we wanted, we could also pass `senderEmail` in the body and look up the user.
    const [newMessage] = await db.insert(ticketMessages).values({
      ticketId,
      content,
      senderType: "system",
      source: "api",
      isInternalNote: false,
    }).returning();

    return NextResponse.json({ success: true, message: newMessage }, { status: 201 });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
