"use client";

import {
  DEFAULT_TICKET_CONFIGURATION,
  type TicketConfiguration,
} from "@/lib/tickets/ticket-configuration";

type Module = { id: string };

const STORAGE_KEY = "salamdesk.ticket.configuration";

export function normalizeConfiguration(
  configuration: TicketConfiguration,
  modules: Module[],
) {
  const validModuleIds = new Set(modules.map((module) => module.id));
  const enabledModuleIds = configuration.enabledModuleIds.filter((id) =>
    validModuleIds.has(id),
  );

  return {
    ...DEFAULT_TICKET_CONFIGURATION,
    ...configuration,
    enabledModuleIds:
      enabledModuleIds.length > 0
        ? enabledModuleIds
        : modules.map((module) => module.id),
  };
}

export function loadStoredTicketConfiguration(modules: Module[]) {
  if (typeof window === "undefined") {
    return normalizeConfiguration(DEFAULT_TICKET_CONFIGURATION, modules);
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return normalizeConfiguration(DEFAULT_TICKET_CONFIGURATION, modules);
    }
    return normalizeConfiguration(JSON.parse(stored) as TicketConfiguration, modules);
  } catch {
    return normalizeConfiguration(DEFAULT_TICKET_CONFIGURATION, modules);
  }
}

export function storeTicketConfiguration(configuration: TicketConfiguration) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configuration));
}
