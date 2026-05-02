import { getApiKeysAction, revokeApiKeyAction } from "./actions";
import { GenerateKeyDialog } from "./generate-key-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";

export const metadata = {
  title: "Developer Portal | SalamDesk",
  description: "Manage API Keys for programmatic access.",
};

export default async function DeveloperPortalPage() {
  const apiKeys = await getApiKeysAction();

  const handleRevoke = async (formData: FormData) => {
    "use server";
    const id = formData.get("id") as string;
    await revokeApiKeyAction(id);
    revalidatePath("/app/settings/developer");
  };

  return (
    <div className="flex-1 space-y-6 p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Developer Portal</h3>
          <p className="text-muted-foreground mt-1">
            Kelola API key untuk sistem eksternal agar dapat berinteraksi dengan SalamDesk.
          </p>
        </div>
        <GenerateKeyDialog />
      </div>

      <div className="space-y-4">
        <h4 className="text-lg font-medium">API Key Aktif</h4>
        <div className="border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Belum ada API key yang dibuat.
                  </TableCell>
                </TableRow>
              ) : (
                apiKeys.map((key) => {
                  const isExpired = key.expiresAt && key.expiresAt < new Date();
                  const status = !key.isActive
                    ? "revoked"
                    : isExpired
                      ? "expired"
                      : "active";

                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-xs">{key.prefix}...</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(key.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.expiresAt ? format(new Date(key.expiresAt), "MMM d, yyyy") : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === "active" ? "default" :
                              status === "expired" ? "secondary" : "destructive"
                          }
                          className={status === "expired" ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" : ""}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {status === "active" && (
                          <form action={handleRevoke}>
                            <input type="hidden" name="id" value={key.id} />
                            <Button size="sm" variant="destructive" type="submit">
                              Revoke
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="pt-8 border-t space-y-6">
        <div>
          <h4 className="text-lg font-medium">API Documentation</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Gunakan endpoint ini untuk berinteraksi dengan sistem ticketing secara programatik.
            Sertakan API key Anda di header: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">Authorization: Bearer &lt;YOUR_API_KEY&gt;</code>
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Ticket Docs */}
          <div className="border rounded-xl p-5 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">POST</Badge>
              <code className="text-sm font-semibold">/api/v1/tickets</code>
            </div>
            <p className="text-sm text-muted-foreground">Buat tiket baru dari sistem eksternal.</p>
            <div className="bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto">
              <pre>
{`{
  "title": "Issue title",
  "description": "Detailed description",
  "priority": "low | medium | critical",
  "moduleSlug": "simrs-billing",
  "reporterEmail": "user@example.com",
  "reporterName": "John Doe" // opsional
}`}
              </pre>
            </div>
          </div>

          {/* Get Ticket Docs */}
          <div className="border rounded-xl p-5 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">GET</Badge>
              <code className="text-sm font-semibold">/api/v1/tickets/:id</code>
            </div>
            <p className="text-sm text-muted-foreground">Ambil status dan detail tiket spesifik.</p>
            <div className="bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto mt-auto">
              <pre>
{`// Contoh Respons
{
  "success": true,
  "ticket": {
    "id": "TKT-A1B2C3D4",
    "status": "open",
    "priority": "critical"
  }
}`}
              </pre>
            </div>
          </div>

          {/* Add Message Docs */}
          <div className="border rounded-xl p-5 bg-card space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">POST</Badge>
              <code className="text-sm font-semibold">/api/v1/tickets/:id/messages</code>
            </div>
            <p className="text-sm text-muted-foreground">Tambahkan balasan otomatis atau log sistem ke tiket yang sudah ada.</p>
            <div className="bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto">
              <pre>
{`{
  "content": "Pembaruan otomatis sistem: Server telah berhasil di-restart."
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

