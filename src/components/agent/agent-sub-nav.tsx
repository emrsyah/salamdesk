"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app/agent", label: "Perilaku" },
  { href: "/app/agent/automation", label: "Otomasi & Jadwal" },
  { href: "/app/agent/tools", label: "Tools" },
  { href: "/app/agent/procedures", label: "Prosedur" },
];

export function AgentSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b pb-px">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
