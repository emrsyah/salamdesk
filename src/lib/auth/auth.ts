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
    user: {
        additionalFields: {
            role: { type: "string" },
            vendor: { type: "string" },
            isActive: { type: "boolean" },
        },
    },
});