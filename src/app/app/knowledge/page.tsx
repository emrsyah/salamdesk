import { RiAlertLine, RiBookOpenLine } from "@remixicon/react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-shell";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { KbCreateDialog } from "@/components/knowledge/kb-create-surface";
import { KbListClient } from "@/components/knowledge/kb-list-client";
import { getCachedAllModules } from "@/lib/cache";
import { getAllKbArticles } from "@/services/knowledge.service";
import { getSession } from "@/lib/auth/session";

export default async function KnowledgePage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  // KB articles are read uncached: ingestion status changes come from the
  // worker process (which can't invalidate Next's cache tag), and the list
  // client polls this page while documents are processing.
  const [kbArticles, modules] = await Promise.all([
    getAllKbArticles(),
    getCachedAllModules(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        icon={<RiBookOpenLine className="size-5" />}
        title="Knowledge Base"
        description="Kelola dokumen pengetahuan yang akan dipecah menjadi chunk untuk pencarian AI."
        actions={
          <>
            <Button variant="outline" className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50" asChild>
              <Link href="/app/knowledge/gaps">
                <RiAlertLine className="size-4" />
                Laporan Celah
              </Link>
            </Button>
            <KbCreateDialog modules={modules} />
          </>
        }
      />

      <KbListClient articles={kbArticles} modules={modules} />
    </PageContainer>
  );
}
