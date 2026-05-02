import { KbArticleForm } from "@/components/knowledge/kb-article-form";
import { getAllModules } from "@/services/module.service";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewKbArticlePage(props: { searchParams: Promise<{ title?: string; moduleId?: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const searchParams = await props.searchParams;
  const modules = await getAllModules();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Tambah Artikel Baru</h1>
        <p className="text-muted-foreground">Tulis artikel basis pengetahuan baru untuk membantu pengguna.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail Artikel</CardTitle>
          <CardDescription>Masukkan judul, modul terkait, dan konten artikel.</CardDescription>
        </CardHeader>
        <CardContent>
          <KbArticleForm 
            modules={modules} 
            initialData={{
              id: "",
              title: searchParams.title || "",
              content: "",
              moduleId: searchParams.moduleId || null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
