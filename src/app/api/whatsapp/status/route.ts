import { NextResponse } from "next/server";
import { redisConnection } from "@/lib/redis";

export async function GET() {
  try {
    const status = await redisConnection.get("wa-status") || "disconnected";
    const qr = status === "qr" ? await redisConnection.get("wa-qr") : null;

    return NextResponse.json({ status, qr });
  } catch (error) {
    console.error("Failed to fetch WhatsApp status from Redis:", error);
    return NextResponse.json({ status: "error", error: "Failed to connect to Redis" }, { status: 500 });
  }
}
