"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createKbArticleAction, updateKbArticleAction } from "@/actions/knowledge.actions";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const formSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  content: z.string().min(1, "Konten wajib diisi"),
  moduleId: z.string().optional(),
  tags: z.string().optional(),
});

type KbArticleFormProps = {
  initialData?: {
    id: string;
    title: string;
    content: string;
    moduleId?: string | null;
    tags?: string[];
  };
  modules: { id: string; name: string }[];
  onCancel?: () => void;
};

export function KbArticleForm({ initialData, modules, onCancel }: KbArticleFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      content: initialData?.content || "",
      moduleId: initialData?.moduleId || "",
      tags: initialData?.tags?.join(", ") || "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const parsedTags = values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const payload = {
        title: values.title,
        content: values.content,
        moduleId: values.moduleId || null,
        tags: parsedTags,
      };

      if (initialData?.id) {
        await updateKbArticleAction(initialData.id, payload);
        toast.success("Dokumen berhasil diperbarui");
      } else {
        await createKbArticleAction(payload);
        toast.success("Dokumen berhasil dibuat");
      }
      
      router.push("/app/knowledge");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan dokumen";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Judul Dokumen</FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Cara reset password SIMRS" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="moduleId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modul (Opsional)</FormLabel>
              <FormControl>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...field}
                >
                  <option value="">-- Tidak ada modul --</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormDescription>Pilih modul jika dokumen ini spesifik untuk satu modul.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Konten</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Isi dokumen pengetahuan..."
                  className="min-h-[260px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags (Opsional)</FormLabel>
              <FormControl>
                <Input placeholder="login, password, error (pisahkan dengan koma)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel ?? (() => router.back())} disabled={isLoading}>
            Batal
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Menyimpan..." : "Simpan Dokumen"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
