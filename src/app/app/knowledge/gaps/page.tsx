import { getCachedKbGaps, getCachedAllModules } from "@/lib/cache";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiArrowLeftLine, RiFileAddLine } from "@remixicon/react";
import Link from "next/link";

export default async function KbGapsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [gaps, modules] = await Promise.all([
    getCachedKbGaps(50),
    getCachedAllModules(),
  ]);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4 text-muted-foreground gap-2">
          <Link href="/app/knowledge">
            <RiArrowLeftLine className="size-4" /> Kembali ke Knowledge Base
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-orange-600">Laporan Celah Pengetahuan</h1>
        <p className="text-muted-foreground">
          Daftar tiket yang telah diselesaikan tetapi belum memiliki artikel Knowledge Base yang terkait. 
          Gunakan daftar ini untuk mengetahui topik apa yang sering ditanyakan dan buat artikel untuk membantu bot AI.
        </p>
      </div>

      <div className="grid gap-4">
        {gaps.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="text-lg font-medium text-green-600">Semua Baik!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tidak ada celah pengetahuan yang terdeteksi saat ini.
              </p>
            </CardContent>
          </Card>
        ) : (
          gaps.map((gap) => {
            const moduleName = modules.find((m) => m.id === gap.moduleId)?.name;
            return (
              <Card key={gap.ticketId}>
                <CardHeader className="py-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <CardTitle className="text-lg mb-1">{gap.title}</CardTitle>
                      <CardDescription className="line-clamp-2 mb-2">
                        {gap.description || "Tidak ada deskripsi"}
                      </CardDescription>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Tiket #{gap.ticketId.slice(0, 8).toUpperCase()}</span>
                        {moduleName && <Badge variant="outline" className="text-[10px]">{moduleName}</Badge>}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 gap-1" asChild>
                      <Link href={`/app/knowledge/new?title=${encodeURIComponent(gap.title)}&moduleId=${gap.moduleId || ""}`}>
                        <RiFileAddLine className="size-3.5" /> Buat Artikel
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
