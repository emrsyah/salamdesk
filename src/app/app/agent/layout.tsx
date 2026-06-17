import { redirect } from "next/navigation";
import { RiSparklingLine } from "@remixicon/react";
import { getSession } from "@/lib/auth/session";
import { AgentSubNav } from "@/components/agent/agent-sub-nav";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");
  const role = (session.user as { role?: string }).role;
  if (!["owner", "admin"].includes(role ?? "")) redirect("/app/tickets");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 lg:p-8">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-amber-400/20">
          <RiSparklingLine className="size-5 text-amber-600 dark:text-amber-400" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agent</h1>
          <p className="text-sm text-muted-foreground">
            Atur perilaku, tools, dan otomasi balasan agen AI.
          </p>
        </div>
      </div>
      <AgentSubNav />
      <div>{children}</div>
    </div>
  );
}
