import "server-only";

import {
  getCachedActiveModules,
  getCachedAssignableStaff,
  getCachedModulesByUserId,
  getCachedQuickReplies,
} from "@/lib/cache";
import { getTicketById, getTickets } from "@/services/ticket.service";

type UserWithRole = {
  id: string;
  role: string;
};

type ClientTicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TicketSearchParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function getTicketFilters(searchParams: TicketSearchParams) {
  return {
    assignee: getSearchParam(searchParams, "assignee") ?? undefined,
    priority: getSearchParam(searchParams, "priority") ?? undefined,
    sla: getSearchParam(searchParams, "sla") ?? undefined,
    module: getSearchParam(searchParams, "module") ?? undefined,
    status:
      getSearchParam(searchParams, "status") === "waiting"
        ? undefined
        : getSearchParam(searchParams, "status") ?? undefined,
    resolvedBy: getSearchParam(searchParams, "resolvedBy") ?? undefined,
  };
}

export function getSelectedTicketId(searchParams: TicketSearchParams) {
  return getSearchParam(searchParams, "selected");
}

export async function getTicketPageData(
  user: UserWithRole,
  searchParams: TicketSearchParams,
) {
  const filters = getTicketFilters(searchParams);
  const selectedId = getSelectedTicketId(searchParams);

  const [allActiveModules, userModules, quickReplies, assignableStaff] =
    await Promise.all([
      getCachedActiveModules(),
      user.role === "operator" || user.role === "engineer"
        ? getCachedModulesByUserId(user.id, { activeOnly: true })
        : Promise.resolve(undefined),
      getCachedQuickReplies(),
      getCachedAssignableStaff(),
    ]);

  const moduleOptions = userModules ?? allActiveModules;
  const viewableModuleIds =
    user.role === "owner" || user.role === "admin" || user.role === "supervisor"
      ? allActiveModules.map((module) => module.id)
      : (userModules ?? []).map((module) => module.id);
  const normalizedFilters = normalizeTicketFilters(filters, moduleOptions);

  const [tickets, selectedTicket] = await Promise.all([
    normalizedFilters
      ? getTickets({
          userId: user.id,
          role: user.role,
          moduleIds: viewableModuleIds,
          filters: normalizedFilters,
        })
      : Promise.resolve([]),
    selectedId ? getTicketById(selectedId) : Promise.resolve(null),
  ]);

  return {
    moduleOptions: serializeForClient(moduleOptions),
    quickReplies: serializeForClient(quickReplies),
    assignableStaff: serializeForClient(assignableStaff),
    initialTickets: serializeForClient(tickets.map(normalizeTicketListEntry)),
    initialTicket: serializeForClient(
      selectedTicket ? normalizeTicketListEntry(selectedTicket) : null,
    ),
  };
}

export async function getTicketListForRequest(
  user: UserWithRole,
  searchParams: URLSearchParams,
) {
  const filters = getTicketFilters(searchParams);
  const [allActiveModules, userModules] = await Promise.all([
    getCachedActiveModules(),
    user.role === "operator" || user.role === "engineer"
      ? getCachedModulesByUserId(user.id, { activeOnly: true })
      : Promise.resolve(undefined),
  ]);

  const viewableModuleIds =
    user.role === "owner" || user.role === "admin" || user.role === "supervisor"
      ? allActiveModules.map((module) => module.id)
      : (userModules ?? []).map((module) => module.id);
  const moduleOptions = userModules ?? allActiveModules;
  const normalizedFilters = normalizeTicketFilters(filters, moduleOptions);

  const tickets = normalizedFilters
    ? await getTickets({
        userId: user.id,
        role: user.role,
        moduleIds: viewableModuleIds,
        filters: normalizedFilters,
      })
    : [];

  return serializeForClient(tickets.map(normalizeTicketListEntry));
}

function normalizeTicketFilters<T extends ReturnType<typeof getTicketFilters>>(
  filters: T,
  moduleOptions: { id: string; slug: string }[],
): T | null {
  if (!filters.module) return filters;

  const module = moduleOptions.find(
    (candidate) =>
      candidate.id === filters.module || candidate.slug === filters.module,
  );

  return module ? { ...filters, module: module.id } : null;
}

function getSearchParam(searchParams: TicketSearchParams, key: string) {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key);
  }

  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value ?? null;
}

function normalizeTicketListEntry<T extends { status: string; assigneeId?: string | null }>(
  ticket: T,
): Omit<T, "status"> & { status: ClientTicketStatus } {
  return {
    ...ticket,
    status:
      ticket.status === "waiting"
        ? ticket.assigneeId
          ? "in_progress"
          : "open"
        : ticket.status,
  } as Omit<T, "status"> & { status: ClientTicketStatus };
}

function serializeForClient<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
