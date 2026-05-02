import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys/api-keys.service";
import { db } from "@/db";
import { tickets, users, modules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  return await validateApiKey(token);
}

export async function POST(req: NextRequest) {
  try {
    const isAuthorized = await verifyAuth(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, priority, moduleSlug, reporterEmail, reporterName } = body;

    if (!title || !priority || !moduleSlug || !reporterEmail) {
      return NextResponse.json({ error: "Missing required fields: title, priority, moduleSlug, reporterEmail" }, { status: 400 });
    }

    // 1. Find or create reporter
    let [reporter] = await db.select().from(users).where(eq(users.email, reporterEmail));
    if (!reporter) {
      // Very basic user creation for reporters via API
      [reporter] = await db.insert(users).values({
        id: nanoid(),
        email: reporterEmail,
        name: reporterName || reporterEmail.split("@")[0],
        role: "reporter",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
    }

    // 2. Find module
    const [moduleRecord] = await db.select().from(modules).where(eq(modules.slug, moduleSlug));
    if (!moduleRecord) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // 3. Create ticket
    const ticketId = `TKT-${nanoid(8).toUpperCase()}`;
    const [newTicket] = await db.insert(tickets).values({
      id: ticketId,
      title,
      description,
      priority,
      moduleId: moduleRecord.id,
      createdById: reporter.id,
      source: "api",
      status: "open",
    }).returning();

    return NextResponse.json({ success: true, ticket: newTicket }, { status: 201 });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
