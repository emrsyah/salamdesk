/**
 * Axiom client (web only).
 *
 * The Next.js app runs on Vercel Hobby, where log drains are Pro-gated, so the
 * web side ships logs to Axiom directly over the API via @axiomhq/nextjs.
 * (The VPS worker uses Pino → stdout → Vector → Axiom instead — see
 * src/lib/logger.ts and vector.toml.)
 */
import { Axiom } from "@axiomhq/js";

const axiomClient = new Axiom({
  token: process.env.AXIOM_TOKEN!,
});

export default axiomClient;
