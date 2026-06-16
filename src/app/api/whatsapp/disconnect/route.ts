import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { redisConnection } from "@/lib/redis";

/**
 * Requests a WhatsApp disconnect. The Baileys socket lives in the worker
 * process, so we publish a command on the "wa-control" channel and let the
 * worker perform the actual logout + reconnect (see src/worker/index.ts).
 */
export async function POST() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (!["owner", "admin"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Optimistic status so the UI reflects the action before the worker reacts.
    // Set both keys together, then signal the worker once state is in place.
    await Promise.all([
      redisConnection.set("wa-status", "connecting"),
      redisConnection.del("wa-qr"),
    ]);
    const receivers = await redisConnection.publish("wa-control", "disconnect");

    if (receivers === 0) {
      return NextResponse.json(
        { error: "Worker tidak aktif. Pastikan worker berjalan." },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to request WhatsApp disconnect:", error);
    return NextResponse.json(
      { error: "Gagal memutuskan koneksi." },
      { status: 500 },
    );
  }
}
