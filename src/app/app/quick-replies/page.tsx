import { RiChatQuoteLine, RiAddLine, RiEditLine, RiDeleteBinLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { getQuickReplies } from "@/services/quick-reply.service";
import { getAllModules } from "@/services/module.service";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function QuickRepliesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const quickReplies = await getQuickReplies();
  const modules = await getAllModules();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quick Replies</h1>
          <p className="text-muted-foreground">Kelola template balasan untuk mempercepat penanganan tiket.</p>
        </div>
        <Button className="gap-2">
          <RiAddLine className="size-4" />
          Tambah Template
        </Button>
      </div>

      <div className="grid gap-6">
        {quickReplies.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <RiChatQuoteLine className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Belum ada template</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Buat template pertama Anda untuk mulai menggunakannya di tiket.
              </p>
              <Button variant="outline">Buat Template</Button>
            </CardContent>
          </Card>
        ) : (
          quickReplies.map((qr) => (
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
                  <Button variant="ghost" size="icon" className="size-8">
                    <RiEditLine className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <RiDeleteBinLine className="size-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
