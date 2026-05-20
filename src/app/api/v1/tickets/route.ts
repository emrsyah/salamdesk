import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys/api-keys.service";
import { db } from "@/db";
import { modules } from "@/db/schema/modules";
import { eq } from "drizzle-orm";
import { createTicket } from "@/services/ticket.service";
import { findOrCreateRequesterByIdentity } from "@/services/requester.service";

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
    const { title, description, priority, moduleSlug, reporterEmail, reporterName, reporterPhone, externalRef } = body;

    if (!title || !priority || !moduleSlug || (!reporterEmail && !reporterPhone)) {
      return NextResponse.json({ error: "Missing required fields: title, priority, moduleSlug, reporterEmail or reporterPhone" }, { status: 400 });
    }

    const requesterId = await findOrCreateRequesterByIdentity(
      reporterEmail ? "email" : "whatsapp",
      reporterEmail || reporterPhone,
      {
        displayName: reporterName,
        fullName: reporterName,
        email: reporterEmail,
        phone: reporterPhone,
        externalRef,
      },
    );

    // 2. Find module
    const [moduleRecord] = await db.select().from(modules).where(eq(modules.slug, moduleSlug));
    if (!moduleRecord) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const newTicket = await createTicket({
      title,
      description,
      priority,
      moduleId: moduleRecord.id,
      source: "api",
      requesterId,
    });

    return NextResponse.json({ success: true, ticket: newTicket }, { status: 201 });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
