import IORedis from "ioredis";

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

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redisConnection;
}
