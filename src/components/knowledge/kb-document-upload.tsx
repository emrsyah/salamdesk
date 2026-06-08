"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadDropzone } from "@/lib/uploadthing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type KbDocumentUploadProps = {
  modules: { id: string; name: string }[];
  defaultTitle?: string;
  defaultModuleId?: string | null;
};

export function KbDocumentUpload({ modules, defaultTitle = "", defaultModuleId = null }: KbDocumentUploadProps) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [moduleId, setModuleId] = useState(defaultModuleId ?? "");
  const [tags, setTags] = useState("");

  const parsedTags = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="upload-title">Judul Dokumen</Label>
        <Input
          id="upload-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Contoh: Panduan bridging BPJS"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="upload-module">Modul</Label>
        <select
          id="upload-module"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={moduleId}
          onChange={(event) => setModuleId(event.target.value)}
        >
          <option value="">-- Tidak ada modul --</option>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="upload-tags">Tags</Label>
        <Input
          id="upload-tags"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="login, billing, bpjs"
        />
      </div>

      <UploadDropzone
        endpoint="knowledgeDocumentUploader"
        input={{
          title,
          moduleId: moduleId || null,
          tags: parsedTags,
        }}
        config={{ mode: "auto" }}
        disabled={title.trim().length === 0}
        onClientUploadComplete={(files) => {
          const documentId = files[0]?.serverData?.documentId;
          toast.success("Dokumen berhasil diupload dan sedang diproses");
          router.push(documentId ? `/app/knowledge/${documentId}` : "/app/knowledge");
          router.refresh();
        }}
        onUploadError={(error) => {
          toast.error(error.message || "Gagal mengupload dokumen");
        }}
        className="ut-label:text-sm ut-allowed-content:text-xs ut-button:bg-primary ut-button:text-primary-foreground"
      />
    </div>
  );
}
