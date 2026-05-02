import { Queue } from "bullmq";
import { redisConnection } from "./redis";

/**
 * Inbound WA messages → processed by the worker to create/append tickets.
 */
export const waInboundQueue = new Queue("wa-inbound", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

/**
 * Outbound WA messages → processed by the worker to call Baileys sock.sendMessage().
 */
export const waOutboundQueue = new Queue("wa-outbound", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

export type WaInboundJob = {
  phone: string; // e.g. "6281234567890"
  text: string;
  pushName: string | null;
  messageId: string;
};

export type WaOutboundJob = {
  phone: string; // e.g. "6281234567890"
  text: string;
};
