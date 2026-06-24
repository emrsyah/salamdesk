import IORedis from "ioredis";
import { log } from "@/lib/logger";

const xlog = log("ioredis");

/**
 * Shared IORedis connection used by BullMQ queues and workers.
 * `maxRetriesPerRequest: null` is required by BullMQ.
 */
const globalForRedis = globalThis as unknown as { redis: IORedis | undefined };

export const redisConnection =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

redisConnection.on("error", (err) => {
  // Catch unhandled error events to prevent application crashes
  // Redis will still attempt to reconnect
  xlog.error({ err }, "connection error");
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redisConnection;
}
