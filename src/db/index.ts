import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from environment variables");
}

const queryClient = postgres(process.env.DATABASE_URL);

export const db = drizzle(queryClient, { schema });

export { queryClient };