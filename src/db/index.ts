import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from environment variables");
}

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

// prepare:false is REQUIRED when connecting through Supabase's transaction-mode
// pooler (port 6543): Supavisor does not support client-side prepared statements
// in transaction mode, which can silently corrupt/misroute statements inside
// db.transaction() blocks.
// connect_timeout (seconds) caps how long a cold/paused pooler can stall a
// request: without it, a paused Supabase project hangs the route for minutes
// while the OS retries TCP. Fail fast and let the next request retry instead.
const queryClient =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL, { max: 10, prepare: false, connect_timeout: 20 });
if (process.env.NODE_ENV !== "production") globalForDb.conn = queryClient;

export const db = drizzle(queryClient, { schema });

export { queryClient };