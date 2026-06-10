import { RiAlertLine } from "@remixicon/react";
import Link from "next/link";
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
    <div className="flex-1 space-y-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">Kelola dokumen pengetahuan yang akan dipecah menjadi chunk untuk pencarian AI.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50" asChild>
            <Link href="/app/knowledge/gaps">
              <RiAlertLine className="size-4" />
              Laporan Celah
            </Link>
          </Button>
          <KbCreateDialog modules={modules} />
        </div>
      </div>

      <KbListClient articles={kbArticles} modules={modules} />
    </div>
  );
}
