"use client";

import { useState } from "react";
import {
  RiAddLine,
  RiFileTextLine,
  RiUploadCloud2Line,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KbArticleForm } from "./kb-article-form";
import { KbDocumentUpload } from "./kb-document-upload";

type Module = { id: string; name: string };

type KbCreateSurfaceProps = {
  modules: Module[];
  defaultTitle?: string;
  defaultModuleId?: string | null;
  onCancel?: () => void;
};

function KbCreateTabs({
  modules,
  defaultTitle = "",
  defaultModuleId = null,
  onCancel,
}: KbCreateSurfaceProps) {
  return (
    <Tabs defaultValue="manual" className="gap-5">
      <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl bg-muted/70 p-1">
        <TabsTrigger value="manual" className="h-full rounded-xl gap-2">
          <RiFileTextLine className="size-4" />
          Teks Manual
        </TabsTrigger>
        <TabsTrigger value="upload" className="h-full rounded-xl gap-2">
          <RiUploadCloud2Line className="size-4" />
          Upload File
        </TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="outline-none">
        <div className="rounded-2xl border bg-background p-5">
          <KbArticleForm
            modules={modules}
            onCancel={onCancel}
            initialData={{
              id: "",
              title: defaultTitle,
              content: "",
              moduleId: defaultModuleId,
            }}
          />
        </div>
      </TabsContent>

      <TabsContent value="upload" className="outline-none">
        <div className="rounded-2xl border bg-background p-5">
          <KbDocumentUpload
            modules={modules}
            defaultTitle={defaultTitle}
            defaultModuleId={defaultModuleId}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}

export function KbCreateDialog({
  modules,
  defaultTitle,
  defaultModuleId,
}: KbCreateSurfaceProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <RiAddLine className="size-4" />
          Tambah Dokumen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl p-0 sm:max-w-3xl">
        <div className="border-b bg-muted/25 px-6 py-6 sm:px-8">
          <DialogHeader className="max-w-2xl">
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              Tambah pengetahuan baru
            </DialogTitle>
            <DialogDescription>
              Pilih cara menambahkan konten. Tulis langsung atau upload dokumen
              untuk diproses menjadi bahan pencarian AI.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="px-6 pb-6 sm:px-8">
          <KbCreateTabs
            modules={modules}
            defaultTitle={defaultTitle}
            defaultModuleId={defaultModuleId}
            onCancel={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function KbCreatePageSurface(props: KbCreateSurfaceProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 lg:p-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Knowledge Base</p>
        <h1 className="text-3xl font-bold tracking-tight">Tambah pengetahuan baru</h1>
        <p className="max-w-2xl text-muted-foreground">
          Tambahkan konten manual atau upload file dari satu tempat tanpa
          memisahkan alur kerja.
        </p>
      </div>
      <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <KbCreateTabs {...props} />
      </div>
    </div>
  );
}
