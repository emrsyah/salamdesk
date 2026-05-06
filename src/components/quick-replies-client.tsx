"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiChatQuoteLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type QuickReply = {
  id: string;
  label: string;
  content: string;
  moduleId: string | null;
  createdAt: Date;
};

type Module = {
  id: string;
  name: string;
  color: string | null;
};

interface QuickRepliesClientProps {
  initialQuickReplies: QuickReply[];
  modules: Module[];
}

export function QuickRepliesClient({ initialQuickReplies, modules }: QuickRepliesClientProps) {
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingQuickReply, setEditingQuickReply] = React.useState<QuickReply | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deletingQuickReply, setDeletingQuickReply] = React.useState<QuickReply | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [label, setLabel] = React.useState("");
  const [content, setContent] = React.useState("");
  const [moduleId, setModuleId] = React.useState<string>("");

  const resetForm = () => {
    setLabel("");
    setContent("");
    setModuleId("");
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { createQuickReplyAction } = await import("@/actions/quick-replies.actions");
      await createQuickReplyAction({
        label,
        content,
        moduleId: moduleId || null,
      });

      toast.success("Template berhasil ditambahkan");
      setIsAddDialogOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuickReply) return;

    setIsSubmitting(true);

    try {
      const { updateQuickReplyAction } = await import("@/actions/quick-replies.actions");
      await updateQuickReplyAction(editingQuickReply.id, {
        label,
        content,
        moduleId: moduleId || null,
      });

      toast.success("Template berhasil diperbarui");
      setIsEditDialogOpen(false);
      setEditingQuickReply(null);
      resetForm();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (qr: QuickReply) => {
    setEditingQuickReply(qr);
    setLabel(qr.label);
    setContent(qr.content);
    setModuleId(qr.moduleId || "");
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (qr: QuickReply) => {
    setDeletingQuickReply(qr);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingQuickReply) return;

    setIsSubmitting(true);

    try {
      const { deleteQuickReplyAction } = await import("@/actions/quick-replies.actions");
      await deleteQuickReplyAction(deletingQuickReply.id);

      toast.success("Template berhasil dihapus");
      setIsDeleteDialogOpen(false);
      setDeletingQuickReply(null);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6">
      {initialQuickReplies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <RiChatQuoteLine className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">Belum ada template</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Buat template pertama Anda untuk mulai menggunakannya di tiket.
            </p>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
              <RiAddLine className="mr-2 size-4" />
              Buat Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setIsAddDialogOpen(true)} className="w-full sm:w-auto ml-auto">
          <RiAddLine className="mr-2 size-4" />
          Tambah Template
        </Button>
      )}

      {initialQuickReplies.length > 0 &&
        initialQuickReplies.map((qr) => (
          <Card key={qr.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2">
                  {qr.label}
                  {qr.moduleId && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {modules.find((m) => m.id === qr.moduleId)?.name}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="line-clamp-2 text-sm">
                  {qr.content}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => handleEditClick(qr)}
                >
                  <RiEditLine className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteClick(qr)}
                >
                  <RiDeleteBinLine className="size-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))
      }

      {/* Add Quick Reply Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Template Baru</DialogTitle>
            <DialogDescription>
              Buat template balasan cepat untuk mempercepat penanganan tiket.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-label">Label</Label>
              <Input
                id="add-label"
                placeholder="Contoh: Sapaan Awal"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-content">Konten</Label>
              <Textarea
                id="add-content"
                placeholder="Contoh: Halo, terima kasih telah menghubungi kami..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-module">Modul</Label>
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger id="add-module" className="w-full">
                  <SelectValue placeholder="Semua Modul" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua Modul</SelectItem>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Tambah Template"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Quick Reply Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Template: {editingQuickReply?.label}</DialogTitle>
            <DialogDescription>
              Ubah label, konten, atau modul untuk template ini.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-label">Label</Label>
              <Input
                id="edit-label"
                placeholder="Contoh: Sapaan Awal"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Konten</Label>
              <Textarea
                id="edit-content"
                placeholder="Contoh: Halo, terima kasih telah menghubungi kami..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-module">Modul</Label>
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger id="edit-module" className="w-full">
                  <SelectValue placeholder="Semua Modul" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua Modul</SelectItem>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingQuickReply(null);
                  resetForm();
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Quick Reply Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Template</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus template "{deletingQuickReply?.label}"? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingQuickReply(null);
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
