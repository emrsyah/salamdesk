import { redirect } from "next/navigation";
import { RiSparklingLine } from "@remixicon/react";
import { getSession } from "@/lib/auth/session";
import { AgentSubNav } from "@/components/agent/agent-sub-nav";
import { PageContainer, PageHeader } from "@/components/page-shell";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const role = (session.user as { role?: string }).role;
  if (!["owner", "admin"].includes(role ?? "")) redirect("/app/tickets");

  return (
    <PageContainer>
      <PageHeader
        icon={<RiSparklingLine className="size-5" />}
        title="AI Agent"
        description="Atur perilaku, tools, dan otomasi balasan agen AI."
      />
      <AgentSubNav />
      <div>{children}</div>
    </PageContainer>
  );
}
