"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  RiBookReadLine,
  RiDeleteBinLine,
  RiEditLine,
  RiErrorWarningLine,
  RiFilePdf2Line,
  RiFileTextLine,
  RiFileWordLine,
  RiLoopLeftLine,
  RiQuillPenLine,
  RiSearchLine,
} from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type KbArticle = {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  ingestionStatus: string;
  ingestionError: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  isActive: boolean;
  moduleId: string | null;
  tags: string[] | null;
  updatedAt: Date;
};

type Module = {
  id: string;
  name: string;
  color: string | null;
};

interface KbListClientProps {
  articles: KbArticle[];
  modules: Module[];
}

type StatusFilter = "all" | "ready" | "inflight" | "failed" | "inactive";

function isInFlight(status: string) {
  return status === "pending" || status === "processing";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SourceIcon({ article }: { article: KbArticle }) {
  if (article.sourceType === "manual") {
    return <RiQuillPenLine className="size-4 text-muted-foreground" />;
  }
  const name = article.originalFileName?.toLowerCase() ?? "";
  if (name.endsWith(".pdf") || article.mimeType === "application/pdf") {
    return <RiFilePdf2Line className="size-4 text-red-600" />;
  }
  if (name.endsWith(".docx")) {
    return <RiFileWordLine className="size-4 text-blue-600" />;
  }
  return <RiFileTextLine className="size-4 text-muted-foreground" />;
}

export function KbListClient({ articles, modules }: KbListClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deletingArticle, setDeletingArticle] = useState<KbArticle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});
  const [updatingActiveIds, setUpdatingActiveIds] = useState<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const getArticleActiveState = (article: KbArticle) =>
    activeOverrides[article.id] ?? article.isActive;

  // Live progress: while any document is still being ingested by the worker,
  // re-render the server page every few seconds so statuses update in place.
  const hasInFlight = articles.some((article) => isInFlight(article.ingestionStatus));
  useEffect(() => {
    if (!hasInFlight) return;
    const intervalId = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(intervalId);
  }, [hasInFlight, router]);

  const counts = useMemo(
    () => ({
      all: articles.length,
      ready: articles.filter((a) => a.ingestionStatus === "ready").length,
      inflight: articles.filter((a) => isInFlight(a.ingestionStatus)).length,
      failed: articles.filter((a) => a.ingestionStatus === "failed").length,
      inactive: articles.filter((a) => !getArticleActiveState(a)).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [articles, activeOverrides],
  );

  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      searchQuery === "" ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesModule = selectedModuleId === "all" || article.moduleId === selectedModuleId;

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "ready"
          ? article.ingestionStatus === "ready"
          : statusFilter === "inflight"
            ? isInFlight(article.ingestionStatus)
            : statusFilter === "failed"
              ? article.ingestionStatus === "failed"
              : !getArticleActiveState(article);

    return matchesSearch && matchesModule && matchesStatus;
  });

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

    setActiveOverrides((current) => ({ ...current, [article.id]: isActive }));
    setUpdatingActiveIds((current) => new Set(current).add(article.id));

    try {
      const { setKbArticleActiveAction } = await import("@/actions/knowledge.actions");
      await setKbArticleActiveAction(article.id, isActive);
      toast.success(isActive ? "Dipakai AI lagi" : "Disembunyikan dari AI");
      router.refresh();
    } catch {
      setActiveOverrides((current) => ({ ...current, [article.id]: previousActive }));
      toast.error("Gagal memperbarui status KB");
    } finally {
      setUpdatingActiveIds((current) => {
        const next = new Set(current);
        next.delete(article.id);
        return next;
      });
    }
  };

  const handleRetry = async (article: KbArticle) => {
    setRetryingIds((current) => new Set(current).add(article.id));
    try {
      const { retryKbIngestionAction } = await import("@/actions/knowledge.actions");
      await retryKbIngestionAction(article.id);
      toast.success("Dokumen diproses ulang.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memproses ulang dokumen.");
    } finally {
      setRetryingIds((current) => {
        const next = new Set(current);
        next.delete(article.id);
        return next;
      });
    }
  };

  if (articles.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <RiBookReadLine className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Belum ada pengetahuan</h3>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            Tambahkan dokumen pertama — AI memakainya untuk menjawab tiket secara
            otomatis dan membantu draf balasan.
          </p>
          <Button asChild>
            <Link href="/app/knowledge/new">Tambah Dokumen</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusChips: { key: StatusFilter; label: string; count: number; show: boolean }[] = [
    { key: "all", label: "Semua", count: counts.all, show: true },
    { key: "ready", label: "Siap dipakai AI", count: counts.ready, show: true },
    { key: "inflight", label: "Diproses", count: counts.inflight, show: counts.inflight > 0 },
    { key: "failed", label: "Gagal", count: counts.failed, show: counts.failed > 0 },
    { key: "inactive", label: "Nonaktif", count: counts.inactive, show: counts.inactive > 0 },
  ];

  return (
    <>
      <div className="mb-6 space-y-3">
        {/* Status chips double as a summary and a filter. */}
        <div className="flex flex-wrap items-center gap-2">
          {statusChips.flatMap((chip) =>
            !chip.show ? [] : [(
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key)}
                aria-pressed={statusFilter === chip.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === chip.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                  chip.key === "failed" && statusFilter !== "failed" && "text-destructive",
                )}
              >
                {chip.key === "inflight" && (
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                  </span>
                )}
                {chip.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] tabular-nums",
                    statusFilter === chip.key ? "bg-background/20" : "bg-muted",
                  )}
                >
                  {chip.count}
                </span>
              </button>
            )]
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari judul atau isi dokumen…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
            <SelectTrigger className="sm:w-52">
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
            <h3 className="mb-2 text-lg font-medium">Tidak ada yang cocok</h3>
            <p className="text-sm text-muted-foreground">
              Coba ubah kata kunci, filter status, atau filter modul.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredArticles.map((kb) => {
            const inFlight = isInFlight(kb.ingestionStatus);
            const failed = kb.ingestionStatus === "failed";
            const active = getArticleActiveState(kb);
            const module = kb.moduleId ? modules.find((m) => m.id === kb.moduleId) : null;

            return (
              <Card
                key={kb.id}
                size="sm"
                className={cn(
                  "transition-shadow hover:shadow-md",
                  failed && "border-destructive/40",
                  !active && "bg-muted/30 opacity-75",
                )}
              >
                <CardHeader className="pb-0">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                        <SourceIcon article={kb} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
                          <Link href={`/app/knowledge/${kb.id}`} className="hover:underline">
                            {kb.title}
                          </Link>
                        </h3>
                        {kb.originalFileName && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {kb.originalFileName}
                            {kb.fileSize ? ` · ${formatFileSize(kb.fileSize)}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex min-h-5 flex-wrap items-center gap-1.5">
                      {inFlight && (
                        <Badge className="gap-1.5 border-amber-200 bg-amber-50 text-[10px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                          <span className="relative flex size-1.5">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                          </span>
                          {kb.ingestionStatus === "pending" ? "Menunggu antrian" : "Sedang diproses AI"}
                        </Badge>
                      )}
                      {failed && (
                        <Badge variant="destructive" className="gap-1 text-[10px] font-medium">
                          <RiErrorWarningLine className="size-3" />
                          Gagal diproses
                        </Badge>
                      )}
                      {!active && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Nonaktif
                        </Badge>
                      )}
                      {module && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className="size-2 rounded-sm"
                            style={{ backgroundColor: module.color ?? "var(--muted-foreground)" }}
                          />
                          {module.name}
                        </span>
                      )}
                      {kb.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  {inFlight ? (
                    <div className="space-y-2 py-1" aria-hidden="true">
                      <div className="h-3 w-full animate-pulse rounded bg-muted" />
                      <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                      <p className="pt-1 text-xs text-muted-foreground">
                        AI sedang membaca, memecah, dan mengindeks dokumen…
                      </p>
                    </div>
                  ) : failed ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="line-clamp-2 text-xs text-destructive">
                        {kb.ingestionError ?? "Penyebab tidak diketahui."}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 gap-1.5 text-xs"
                        disabled={retryingIds.has(kb.id)}
                        onClick={() => handleRetry(kb)}
                      >
                        <RiLoopLeftLine
                          className={cn("size-3.5", retryingIds.has(kb.id) && "animate-spin")}
                        />
                        {retryingIds.has(kb.id) ? "Mengantri ulang…" : "Coba proses ulang"}
                      </Button>
                    </div>
                  ) : (
                    <p className="line-clamp-4 text-sm text-muted-foreground">{kb.content}</p>
                  )}
                </CardContent>

                <CardFooter className="mt-auto justify-between border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      size="sm"
                      checked={active}
                      disabled={updatingActiveIds.has(kb.id) || inFlight}
                      onCheckedChange={(checked) => handleActiveChange(kb, checked)}
                      aria-label={`${active ? "Sembunyikan dari" : "Pakai untuk"} AI: ${kb.title}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {active ? "Dipakai AI" : "Disembunyikan"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {kb.ingestionStatus === "ready" && (
                      <Button variant="ghost" size="icon" className="size-8" asChild>
                        <Link href={`/app/knowledge/${kb.id}/edit`} aria-label={`Edit ${kb.title}`}>
                          <RiEditLine className="size-4" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeletingArticle(kb)}
                      aria-label={`Hapus ${kb.title}`}
                    >
                      <RiDeleteBinLine className="size-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={deletingArticle !== null} onOpenChange={() => setDeletingArticle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Artikel?</DialogTitle>
            <DialogDescription>
              Artikel &quot;{deletingArticle?.title}&quot; akan dihapus secara permanen — termasuk
              dari indeks pencarian AI. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingArticle(null)}>
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
