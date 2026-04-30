/**
 * Re-exports the Better Auth `user` table as `users` for backwards
 * compatibility with all existing schema relations and queries.
 *
 * The source of truth is `auth-schema.ts` at the project root.
 * Do NOT redefine columns here — extend the `user` table in auth-schema.ts.
 */
export { user as users, userRelations as usersRelations } from "../../../auth-schema";