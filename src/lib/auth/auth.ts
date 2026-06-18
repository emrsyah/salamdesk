import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { user, session, account, verification } from "../../../auth-schema";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [
        "http://localhost:6767",
        ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ],
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user,
            session,
            account,
            verification,
        },
    }),
    emailAndPassword: {
        enabled: true,
        autoSignIn: false,
    },
    session: {
        // Store the session in a short-lived signed cookie so getSession()
        // (in pages, API routes, client, and middleware) validates from the
        // cookie instead of a DB round trip. Cuts the dominant per-request
        // latency. Trade-off: role/isActive changes take up to maxAge to
        // propagate — use disableCookieCache on security-critical reads.
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // seconds
        },
    },
    user: {
        additionalFields: {
            role: { type: "string" },
            vendor: { type: "string" },
            isActive: { type: "boolean" },
        },
    },
});