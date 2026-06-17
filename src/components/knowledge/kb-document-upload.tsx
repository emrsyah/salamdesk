"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RiCloseLine,
  RiFilePdf2Line,
  RiFileTextLine,
  RiFileWordLine,
  RiUploadCloud2Line,
} from "@remixicon/react";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown"];
const MAX_FILE_SIZE = 32 * 1024 * 1024; // mirrors the uploadthing endpoint limit

type KbDocumentUploadProps = {
  modules: { id: string; name: string }[];
  defaultTitle?: string;
  defaultModuleIds?: string[];
};

function fileExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

/** "panduan-bridging_bpjs v2.pdf" → "Panduan bridging bpjs v2" */
function titleFromFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = fileExtension(name);
  if (ext === ".pdf") return <RiFilePdf2Line className="size-5 text-red-600" />;
  if (ext === ".docx") return <RiFileWordLine className="size-5 text-blue-600" />;
  return <RiFileTextLine className="size-5 text-muted-foreground" />;
}

export function KbDocumentUpload({
  modules,
  defaultTitle = "",
  defaultModuleIds = [],
}: KbDocumentUploadProps) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [moduleIds, setModuleIds] = useState<string[]>(defaultModuleIds);
  const [tags, setTags] = useState("");

  const toggleModule = (id: string) =>
    setModuleIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("knowledgeDocumentUploader", {
    onUploadProgress: setProgress,
    onClientUploadComplete: (files) => {
      const documentId = files[0]?.serverData?.documentId;
      toast.success("Dokumen terupload — AI sedang memprosesnya menjadi bahan pencarian.");
      router.push(documentId ? `/app/knowledge/${documentId}` : "/app/knowledge");
      router.refresh();
    },
    onUploadError: (error) => {
      setProgress(0);
      toast.error(error.message || "Gagal mengupload dokumen.");
    },
  });

  function acceptFile(candidate: File) {
    const ext = fileExtension(candidate.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast.error("Format tidak didukung. Gunakan PDF, DOCX, TXT, atau Markdown.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      toast.error("File melebihi 32MB. Kecilkan atau pecah dokumennya dulu.");
      return;
    }
    setFile(candidate);
    // The filename usually IS the title — prefill, but never overwrite what
    // the user already typed.
    if (!title.trim()) setTitle(titleFromFileName(candidate.name));
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  }

  async function handleSubmit() {
    if (!file || !title.trim() || isUploading) return;
    const parsedTags = tags.split(",").flatMap((tag) => {
      const trimmed = tag.trim();
      return trimmed ? [trimmed] : [];
    });
    setProgress(0);
    await startUpload([file], {
      title: title.trim(),
      moduleIds,
      tags: parsedTags,
    });
  }

  const canSubmit = Boolean(file) && title.trim().length > 0 && !isUploading;

  return (
    <div className="space-y-4">
      {/* Step 1 — the file. Always interactive; picking it prefills the title. */}
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileTypeIcon name={file.name} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          {isUploading ? (
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {progress}%
            </span>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setFile(null)}
              aria-label="Hapus file"
            >
              <RiCloseLine className="size-4" />
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50",
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-background shadow-sm">
            <RiUploadCloud2Line className="size-5 text-muted-foreground" />
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {isDragOver ? "Lepaskan file di sini" : "Tarik file ke sini atau klik untuk memilih"}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, TXT, atau Markdown — maksimal 32MB
            </p>
          </div>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Unggah dokumen"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) acceptFile(selected);
          event.target.value = "";
        }}
      />

      {/* Step 2 — metadata. Title is prefilled from the filename. */}
      <div className="space-y-2">
        <Label htmlFor="upload-title">Judul Dokumen</Label>
        <Input
          id="upload-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Contoh: Panduan bridging BPJS"
          disabled={isUploading}
        />
        {file && !title.trim() && (
          <p className="text-xs text-destructive">Judul wajib diisi sebelum upload.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Modul (Opsional)</Label>
          {modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada modul.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {modules.map((module) => {
                const isOn = moduleIds.includes(module.id);
                return (
                  <button
                    key={module.id}
                    type="button"
                    aria-pressed={isOn}
                    disabled={isUploading}
                    onClick={() => toggleModule(module.id)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 " +
                      (isOn
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-muted")
                    }
                  >
                    {module.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="upload-tags">Tags (Opsional)</Label>
          <Input
            id="upload-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="login, billing, bpjs"
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Step 3 — one explicit action, with progress feedback. */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {isUploading && (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
          <RiUploadCloud2Line className="size-4" />
          {isUploading ? `Mengupload… ${progress}%` : "Upload & Proses"}
        </Button>
      </div>
    </div>
  );
}
