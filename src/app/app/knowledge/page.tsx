import { RiAddLine, RiAlertLine } from "@remixicon/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { KbListClient } from "@/components/knowledge/kb-list-client";
import { getCachedKbArticles, getCachedAllModules } from "@/lib/cache";
import { getSession } from "@/lib/auth/session";

export default async function KnowledgePage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const [kbArticles, modules] = await Promise.all([
    getCachedKbArticles(),
    getCachedAllModules(),
  ]);

  return (
    <div className="flex-1 space-y-6 p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">Kelola artikel basis pengetahuan untuk membantu AI dan Agen.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50" asChild>
            <Link href="/app/knowledge/gaps">
              <RiAlertLine className="size-4" />
              Laporan Celah
            </Link>
          </Button>
          <Button className="gap-2" asChild>
            <Link href="/app/knowledge/new">
              <RiAddLine className="size-4" />
              Tambah Artikel
            </Link>
          </Button>
        </div>
      </div>

      <KbListClient articles={kbArticles} modules={modules} />
    </div>
  );
}
