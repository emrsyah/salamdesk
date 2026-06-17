import { KbCreatePageSurface } from "@/components/knowledge/kb-create-surface";
import { getAllModules } from "@/services/module.service";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function NewKbArticlePage(props: { searchParams: Promise<{ title?: string; moduleId?: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const [searchParams, modules] = await Promise.all([props.searchParams, getAllModules()]);

  return (
    <KbCreatePageSurface
      modules={modules}
      defaultTitle={searchParams.title || ""}
      defaultModuleIds={searchParams.moduleId ? [searchParams.moduleId] : []}
    />
  );
}
