import { NextResponse } from "next/server";
import { redisConnection } from "@/lib/redis";
import { log } from "@/lib/logger";
import { withAxiom } from "@/lib/axiom/server";

const xlog = log("api:wa-status");

export const GET = withAxiom(async () => {
  try {
    // Single MGET instead of up to 3 sequential GETs — this endpoint is polled
    // frequently (status page + global banner), and Upstash bills per command.
    const [statusRaw, qrRaw, accountRaw, connectedAtRaw] = await redisConnection.mget(
      "wa-status",
      "wa-qr",
      "wa-account",
      "wa-connected-at",
    );

    const status = statusRaw || "disconnected";
    const qr = status === "qr" ? qrRaw : null;
    const account: { number: string; name: string | null } | null =
      status === "connected" && accountRaw ? JSON.parse(accountRaw) : null;
    const connectedAt = status === "connected" ? connectedAtRaw : null;

    return NextResponse.json({ status, qr, account, connectedAt });
  } catch (error) {
    xlog.error({ err: error }, "failed to fetch whatsapp status from redis");
    return NextResponse.json({ status: "error", error: "Failed to connect to Redis" }, { status: 500 });
  }
});
