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

const queryClient = globalForDb.conn ?? postgres(process.env.DATABASE_URL, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.conn = queryClient;

export const db = drizzle(queryClient, { schema });

export { queryClient };