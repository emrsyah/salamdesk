import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getTickets } from "@/services/ticket.service";
import { getCachedActiveModules, getCachedModulesByUserId } from "@/lib/cache";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as typeof session.user & { role: string };
  const { searchParams } = new URL(request.url);

  const filters = {
    assignee: searchParams.get("assignee") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    sla: searchParams.get("sla") ?? undefined,
    module: searchParams.get("module") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    resolvedBy: searchParams.get("resolvedBy") ?? undefined,
  };

  // Start module fetches in parallel — both are independent
  const [allActiveModules, userModules] = await Promise.all([
    getCachedActiveModules(),
    // Only agents/engineers need their filtered modules; others skip this fetch
    (user.role !== "admin" && user.role !== "reporter")
      ? getCachedModulesByUserId(user.id, { activeOnly: true })
      : Promise.resolve(undefined),
  ]);

  const viewableModuleIds =
    (user.role === "admin" || user.role === "reporter")
      ? allActiveModules.map((m) => m.id)
      : (userModules ?? []).map((m) => m.id);

  const tickets = await getTickets({
    userId: user.id,
    role: user.role,
    moduleIds: viewableModuleIds,
    filters,
  });

  return NextResponse.json(tickets);
}
