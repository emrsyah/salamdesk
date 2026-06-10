import { NextResponse } from "next/server";
import { redisConnection } from "@/lib/redis";

export async function GET() {
  try {
    const status = (await redisConnection.get("wa-status")) || "disconnected";
    const qr = status === "qr" ? await redisConnection.get("wa-qr") : null;

    let account: { number: string; name: string | null } | null = null;
    let connectedAt: string | null = null;
    if (status === "connected") {
      const raw = await redisConnection.get("wa-account");
      account = raw ? JSON.parse(raw) : null;
      connectedAt = await redisConnection.get("wa-connected-at");
    }

    return NextResponse.json({ status, qr, account, connectedAt });
  } catch (error) {
    console.error("Failed to fetch WhatsApp status from Redis:", error);
    return NextResponse.json({ status: "error", error: "Failed to connect to Redis" }, { status: 500 });
  }
}
