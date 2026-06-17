export type ReplyMode = "auto" | "draft-only";
export type BusinessHours = {
  enabled: boolean;
  timezone: string;
  defaultMode: ReplyMode;
  windows: { days: number[]; start: string; end: string; mode: ReplyMode }[];
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  enabled: false,
  timezone: "Asia/Jakarta",
  defaultMode: "auto",
  windows: [],
};

function localParts(tz: string, when: Date): { day: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(when).map((p) => [p.type, p.value]));
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  return { day: dayMap[parts.weekday as string] ?? 0, minutes: hour * 60 + Number(parts.minute) };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Which reply mode applies at `when`. Disabled → always "auto" (no restriction). */
export function resolveReplyMode(hours: BusinessHours, when: Date): ReplyMode {
  if (!hours.enabled) return "auto";
  const { day, minutes } = localParts(hours.timezone, when);
  for (const w of hours.windows) {
    if (w.days.includes(day) && minutes >= toMinutes(w.start) && minutes < toMinutes(w.end)) {
      return w.mode;
    }
  }
  return hours.defaultMode;
}
