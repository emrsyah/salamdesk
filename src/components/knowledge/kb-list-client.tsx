"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { RiBookReadLine, RiDeleteBinLine, RiEditLine, RiFilterLine, RiSearchLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type KbArticle = {
  id: string;
  title: string;
  content: string;
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

export function KbListClient({ articles, modules }: KbListClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("all");
  const [deletingArticle, setDeletingArticle] = useState<KbArticle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
              <Link href="/app/knowledge/new">Buat Artikel</Link>
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
        <div className="grid gap-6">
          {filteredArticles.map((kb) => (
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
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteClick(kb)}
                  >
                    <RiDeleteBinLine className="size-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={deletingArticle !== null} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Artikel?</DialogTitle>
            <DialogDescription>
              Artikel "{deletingArticle?.title}" akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
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
