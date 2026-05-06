import { getCachedQuickReplies, getCachedAllModules } from "@/lib/cache";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { QuickRepliesClient } from "@/components/quick-replies-client";

export default async function QuickRepliesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const [quickReplies, modules] = await Promise.all([
    getCachedQuickReplies(),
    getCachedAllModules(),
  ]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quick Replies</h1>
          <p className="text-muted-foreground">Kelola template balasan untuk mempercepat penanganan tiket.</p>
        </div>
      </div>

      <QuickRepliesClient
        initialQuickReplies={quickReplies}
        modules={modules}
      />
    </div>
  );
}
