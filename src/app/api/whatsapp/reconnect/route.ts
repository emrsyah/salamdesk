import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { redisConnection } from "@/lib/redis";

/**
 * Requests a WhatsApp reconnect after a logout (401). The Baileys socket lives
 * in the worker process, so we publish a command on the "wa-control" channel
 * and let the worker wipe the dead auth + reconnect, producing a fresh QR
 * (see src/worker/index.ts and reconnectWhatsApp in src/lib/whatsapp.ts).
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
    // Optimistic status so the UI leaves the "logged_out" screen immediately,
    // then signal the worker once state is in place.
    await Promise.all([
      redisConnection.set("wa-status", "connecting"),
      redisConnection.del("wa-qr"),
    ]);
    const receivers = await redisConnection.publish("wa-control", "reconnect");

    if (receivers === 0) {
      return NextResponse.json(
        { error: "Worker tidak aktif. Pastikan worker berjalan." },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to request WhatsApp reconnect:", error);
    return NextResponse.json(
      { error: "Gagal menghubungkan ulang." },
      { status: 500 },
    );
  }
}
