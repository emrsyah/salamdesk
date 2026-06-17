import { getKbArticleById, getKbArticleChunkCount } from "@/services/knowledge.service";
import { getAllModules } from "@/services/module.service";
import { getSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiEditLine, RiArrowLeftLine } from "@remixicon/react";
import Link from "next/link";

const sourceTypeLabel: Record<string, string> = {
  manual: "Teks manual",
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  markdown: "Markdown",
  note: "Catatan",
};

const ingestionStatusLabel: Record<string, string> = {
  ready: "Siap digunakan",
  pending: "Menunggu ingestion",
  processing: "Sedang diproses",
  failed: "Gagal diproses",
};

export default async function ViewKbArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const { id } = await params;
  const article = await getKbArticleById(id);

  if (!article) {
    notFound();
  }

  const [modules, chunkCount] = await Promise.all([
    getAllModules(),
    getKbArticleChunkCount(article.id),
  ]);
  const articleModules = modules.filter((m) => article.moduleIds.includes(m.id));

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4 text-muted-foreground gap-2">
          <Link href="/app/knowledge">
            <RiArrowLeftLine className="size-4" /> Kembali
          </Link>
        </Button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{article.title}</h1>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="secondary">{sourceTypeLabel[article.sourceType] ?? article.sourceType}</Badge>
              <Badge variant={article.ingestionStatus === "ready" ? "outline" : "secondary"}>
                {ingestionStatusLabel[article.ingestionStatus] ?? article.ingestionStatus}
              </Badge>
              {articleModules.map((m) => (
                <Badge key={m.id} variant="outline">{m.name}</Badge>
              ))}
              <span className="text-sm text-muted-foreground">
                Diperbarui pada {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(article.updatedAt)}
              </span>
            </div>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/app/knowledge/${article.id}/edit`}>
              <RiEditLine className="size-4" /> Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Sumber</CardTitle>
          </CardHeader>
          <CardContent className="text-base font-medium">
            {sourceTypeLabel[article.sourceType] ?? article.sourceType}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Status Ingestion</CardTitle>
          </CardHeader>
          <CardContent className="text-base font-medium">
            {ingestionStatusLabel[article.ingestionStatus] ?? article.ingestionStatus}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Chunk Pencarian</CardTitle>
          </CardHeader>
          <CardContent className="text-base font-medium">
            {chunkCount} chunk
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none whitespace-pre-wrap">
            {article.content}
          </div>
        </CardContent>
      </Card>
      
      {article.tags && article.tags.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Tags:</span>
          {article.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
