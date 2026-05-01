import { cache } from "react";
import { auth } from "./auth";
import { headers } from "next/headers";

/**
 * React.cache()-wrapped session getter.
 * Deduplicates the getSession() call within a single request — so even if
 * layout.tsx and page.tsx both call this, it only hits the auth API once.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type AppSession = Awaited<ReturnType<typeof getSession>>;
export type AppUser = NonNullable<AppSession>["user"] & { role: string };
