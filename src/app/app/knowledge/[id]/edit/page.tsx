import { KbArticleForm } from "@/components/knowledge/kb-article-form";
import { getAllModules } from "@/services/module.service";
import { getKbArticleById } from "@/services/knowledge.service";
import { getSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditKbArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const { id } = await params;
  const article = await getKbArticleById(id);

  if (!article) {
    notFound();
  }

  const modules = await getAllModules();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Dokumen Pengetahuan</h1>
        <p className="text-muted-foreground">Perbarui konten dokumen. Chunk akan dibuat ulang saat konten disimpan.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail Dokumen</CardTitle>
          <CardDescription>Ubah judul, modul terkait, tags, dan konten dokumen.</CardDescription>
        </CardHeader>
        <CardContent>
          <KbArticleForm 
            modules={modules} 
            initialData={{
              id: article.id,
              title: article.title,
              content: article.content,
              moduleIds: article.moduleIds,
              tags: article.tags || [],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
