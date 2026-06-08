import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getTicketListForRequest } from "@/lib/tickets/ticket-queries";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as typeof session.user & { role: string };
  const { searchParams } = new URL(request.url);
  const tickets = await getTicketListForRequest(user, searchParams);

  return NextResponse.json(tickets);
}
