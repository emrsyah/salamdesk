import { RiBookReadLine, RiAddLine, RiEditLine, RiDeleteBinLine, RiAlertLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { getAllKbArticles } from "@/services/knowledge.service";
import { getAllModules } from "@/services/module.service";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function KnowledgePage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const kbArticles = await getAllKbArticles();
  const modules = await getAllModules();

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

      <div className="grid gap-6">
        {kbArticles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <RiBookReadLine className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Belum ada artikel</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Buat artikel pertama Anda agar AI dapat mulai memberikan saran otomatis.
              </p>
              <Button variant="outline" asChild>
                <Link href="/app/knowledge/new">Buat Artikel</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          kbArticles.map((kb) => (
            <Card key={kb.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Link href={`/app/knowledge/${kb.id}`} className="hover:underline">
                      {kb.title}
                    </Link>
                    {kb.moduleId && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {modules.find((m) => m.id === kb.moduleId)?.name}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-sm">
                    {kb.content}
                  </CardDescription>
                  {kb.tags && kb.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {kb.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-8" asChild>
                    <Link href={`/app/knowledge/${kb.id}/edit`}>
                      <RiEditLine className="size-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <RiDeleteBinLine className="size-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
