"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { RiBookReadLine, RiDeleteBinLine, RiEditLine, RiFilterLine, RiSearchLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type KbArticle = {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  ingestionStatus: string;
  isActive: boolean;
  moduleId: string | null;
  tags: string[] | null;
  updatedAt: Date;
}

type Module = {
  id: string;
  name: string;
  color: string | null;
}

interface KbListClientProps {
  articles: KbArticle[];
  modules: Module[];
}

const sourceTypeLabel: Record<string, string> = {
  manual: "Teks manual",
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  markdown: "Markdown",
  note: "Catatan",
};

const ingestionStatusLabel: Record<string, string> = {
  ready: "Siap",
  pending: "Menunggu",
  processing: "Diproses",
  failed: "Gagal",
};

export function KbListClient({ articles, modules }: KbListClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("all");
  const [deletingArticle, setDeletingArticle] = useState<KbArticle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});
  const [updatingActiveIds, setUpdatingActiveIds] = useState<Set<string>>(new Set());

  const getArticleActiveState = (article: KbArticle) =>
    activeOverrides[article.id] ?? article.isActive;

  const filteredArticles = articles.filter((article) => {
    const matchesSearch = searchQuery === "" || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesModule = selectedModuleId === "all" || article.moduleId === selectedModuleId;
    
    return matchesSearch && matchesModule;
  });

  const handleDeleteClick = (article: KbArticle) => {
    setDeletingArticle(article);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingArticle) return;
    
    setIsDeleting(true);
    try {
      const { deleteKbArticleAction } = await import("@/actions/knowledge.actions");
      await deleteKbArticleAction(deletingArticle.id);
      toast.success("Artikel berhasil dihapus");
      setDeletingArticle(null);
      router.refresh();
    } catch {
      toast.error("Gagal menghapus artikel");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleActiveChange = async (article: KbArticle, isActive: boolean) => {
    const previousActive = getArticleActiveState(article);

    setActiveOverrides((current) => ({
      ...current,
      [article.id]: isActive,
    }));
    setUpdatingActiveIds((current) => new Set(current).add(article.id));

    try {
      const { setKbArticleActiveAction } = await import("@/actions/knowledge.actions");
      await setKbArticleActiveAction(article.id, isActive);
      toast.success(isActive ? "KB diaktifkan" : "KB dinonaktifkan");
      router.refresh();
    } catch {
      setActiveOverrides((current) => ({
        ...current,
        [article.id]: previousActive,
      }));
      toast.error("Gagal memperbarui status KB");
    } finally {
      setUpdatingActiveIds((current) => {
        const next = new Set(current);
        next.delete(article.id);
        return next;
      });
    }
  };

  const handleDialogClose = () => {
    setDeletingArticle(null);
  };

  if (articles.length === 0) {
    return (
      <div className="grid gap-6">
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
              <Link href="/app/knowledge/new">Buat Dokumen</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari artikel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 min-w-[200px]">
          <RiFilterLine className="size-4 text-muted-foreground" />
          <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Filter modul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Modul</SelectItem>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id}>
                  {module.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredArticles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Tidak ada artikel yang cocok</h3>
            <p className="text-sm text-muted-foreground">
              Coba ubah kata kunci pencarian atau filter modul
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredArticles.map((kb) => (
            <Card
              key={kb.id}
              className="transition-shadow hover:shadow-md data-[inactive=true]:bg-muted/20"
              data-inactive={!getArticleActiveState(kb)}
              size="sm"
            >
              <CardHeader className="pb-0">
                <div className="space-y-2">
                  <CardTitle className="line-clamp-2 text-base leading-snug">
                    <Link href={`/app/knowledge/${kb.id}`} className="hover:underline">
                      {kb.title}
                    </Link>
                  </CardTitle>
                  <div className="flex min-h-5 flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {sourceTypeLabel[kb.sourceType] ?? kb.sourceType}
                    </Badge>
                    <Badge
                      variant={kb.ingestionStatus === "ready" ? "outline" : "secondary"}
                      className="text-[10px] font-normal"
                    >
                      {ingestionStatusLabel[kb.ingestionStatus] ?? kb.ingestionStatus}
                    </Badge>
                    <Badge
                      variant={getArticleActiveState(kb) ? "outline" : "secondary"}
                      className="text-[10px] font-normal"
                    >
                      {getArticleActiveState(kb) ? "Aktif" : "Nonaktif"}
                    </Badge>
                    {kb.moduleId && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {modules.find((m) => m.id === kb.moduleId)?.name}
                      </Badge>
                    )}
                    {kb.tags?.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="line-clamp-4 text-sm">
                  {kb.content}
                </CardDescription>
              </CardContent>
              <CardFooter className="mt-auto justify-between border-t pt-3">
                <div className="flex items-center gap-2">
                  <Switch
                    size="sm"
                    checked={getArticleActiveState(kb)}
                    disabled={updatingActiveIds.has(kb.id)}
                    onCheckedChange={(checked) => handleActiveChange(kb, checked)}
                    aria-label={`${getArticleActiveState(kb) ? "Nonaktifkan" : "Aktifkan"} ${kb.title}`}
                  />
                  <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                    <Link href={`/app/knowledge/${kb.id}`}>Buka</Link>
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-8" asChild>
                    <Link href={`/app/knowledge/${kb.id}/edit`} aria-label={`Edit ${kb.title}`}>
                      <RiEditLine className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDeleteClick(kb)}
                    aria-label={`Hapus ${kb.title}`}
                  >
                    <RiDeleteBinLine className="size-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={deletingArticle !== null} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Artikel?</DialogTitle>
            <DialogDescription>
              Artikel &quot;{deletingArticle?.title}&quot; akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogClose}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
