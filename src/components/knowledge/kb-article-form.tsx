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
  moduleIds: z.array(z.string()).optional(),
  tags: z.string().optional(),
});

type KbArticleFormProps = {
  initialData?: {
    id: string;
    title: string;
    content: string;
    moduleIds?: string[] | null;
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
      moduleIds: initialData?.moduleIds ?? [],
      tags: initialData?.tags?.join(", ") || "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const parsedTags = values.tags
        ? values.tags.split(",").flatMap((t) => {
            const trimmed = t.trim();
            return trimmed ? [trimmed] : [];
          })
        : [];

      const payload = {
        title: values.title,
        content: values.content,
        moduleIds: values.moduleIds ?? [],
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
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Konten</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tulis langkah penyelesaian, penyebab umum, atau panduan — ini yang dibaca AI saat menjawab tiket."
                  className="min-h-[240px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="moduleIds"
            render={({ field }) => {
              const selected = field.value ?? [];
              const toggle = (id: string) =>
                field.onChange(
                  selected.includes(id)
                    ? selected.filter((value) => value !== id)
                    : [...selected, id],
                );
              return (
                <FormItem>
                  <FormLabel>Modul (Opsional)</FormLabel>
                  <FormControl>
                    {modules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada modul.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {modules.map((m) => {
                          const isOn = selected.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              aria-pressed={isOn}
                              onClick={() => toggle(m.id)}
                              className={
                                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                                (isOn
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted")
                              }
                            >
                              {m.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </FormControl>
                  <FormDescription>
                    Pilih satu atau beberapa modul. Kosongkan jika berlaku untuk semua modul.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => {
              const previewTags = (field.value ?? "").split(",").flatMap((tag) => {
                const trimmed = tag.trim();
                return trimmed ? [trimmed] : [];
              });
              return (
                <FormItem>
                  <FormLabel>Tags (Opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="login, password, error" {...field} />
                  </FormControl>
                  {previewTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {previewTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <FormDescription>Pisahkan dengan koma.</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

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
