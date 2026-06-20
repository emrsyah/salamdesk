import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getApiKeysAction, revokeApiKeyAction } from "./actions";
import { GenerateKeyDialog } from "./generate-key-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { RiCodeSSlashLine } from "@remixicon/react";
import { PageContainer, PageHeader } from "@/components/page-shell";

export const metadata = {
  title: "Developer Portal | SalamDesk",
  description: "Manage API Keys for programmatic access.",
};

const endpoints = [
  {
    method: "POST",
    path: "/api/v1/tickets",
    tone: "bg-green-600 hover:bg-green-700",
    title: "Create ticket",
    description: "Create a ticket from an external SIMRS, monitoring, or patient-support system.",
    required: ["title", "priority", "moduleSlug", "reporterEmail or reporterPhone"],
    optional: ["description", "reporterName", "reporterPhone", "externalRef"],
    body: `{
  "title": "Billing printout failed",
  "description": "Kasir tidak dapat mencetak invoice setelah pembayaran.",
  "priority": "critical",
  "moduleSlug": "simrs-billing",
  "reporterEmail": "kasir@example.com",
  "reporterName": "Budi Santoso",
  "externalRef": "SIMRS-INC-1042"
}`,
    responses: [
      "201: ticket created",
      "400: missing required field",
      "404: moduleSlug not found",
      "409: requester already has an active ticket",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/tickets/:id",
    tone: "bg-blue-600 hover:bg-blue-700",
    title: "Get ticket status",
    description: "Read the latest status, priority, module, requester, and creation time for one ticket.",
    required: ["ticket id in URL"],
    optional: [],
    body: `{
  "success": true,
  "ticket": {
    "id": "TKT-A1B2C3D4",
    "title": "Billing printout failed",
    "status": "open",
    "priority": "critical",
    "moduleName": "SIMRS Billing"
  }
}`,
    responses: ["200: ticket returned", "401: invalid API key", "404: ticket not found"],
  },
  {
    method: "POST",
    path: "/api/v1/tickets/:id/messages",
    tone: "bg-green-600 hover:bg-green-700",
    title: "Add ticket update",
    description: "Append a requester reply or system update to an existing ticket.",
    required: ["content"],
    optional: ['senderType: "system" or "requester"'],
    body: `{
  "content": "Pembaruan otomatis: service billing sudah direstart.",
  "senderType": "system"
}`,
    responses: [
      "201: message added",
      "400: content is missing",
      "409: ticket lifecycle rejected the update",
    ],
  },
];

function getKeyStatus(key: { isActive: boolean; expiresAt: Date | null }) {
  const expiresAt = key.expiresAt ? new Date(key.expiresAt) : null;
  const isExpired = Boolean(expiresAt && expiresAt < new Date());

  if (!key.isActive) return "revoked";
  if (isExpired) return "expired";
  return "active";
}

function getDaysUntil(date: Date | null) {
  if (!date) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default async function DeveloperPortalPage() {
  // Authoritative RBAC guard. The middleware is only an optimistic fast-path
  // and fails open on a cookie-cache miss, so this server-side check (DB-backed)
  // is what actually keeps non-admins out of the developer portal.
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  if (!["owner", "admin"].includes((session.user as { role?: string }).role ?? "")) {
    redirect("/app/tickets");
  }

  const apiKeys = await getApiKeysAction();
  const activeKeys = apiKeys.filter((key) => getKeyStatus(key) === "active");
  const expiredKeys = apiKeys.filter((key) => getKeyStatus(key) === "expired");
  const revokedKeys = apiKeys.filter((key) => getKeyStatus(key) === "revoked");
  const expiringSoonKeys = activeKeys.filter((key) => {
    const daysUntilExpiry = getDaysUntil(key.expiresAt ? new Date(key.expiresAt) : null);
    return daysUntilExpiry !== null && daysUntilExpiry <= 14;
  });

  const handleRevoke = async (formData: FormData) => {
    "use server";
    const id = formData.get("id") as string;
    await revokeApiKeyAction(id);
    revalidatePath("/app/settings/developer");
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<RiCodeSSlashLine className="size-5" />}
        title="Developer Portal"
        description="Manage API keys, review integration rules, and hand external systems a clear contract for creating tickets or posting operational updates into SalamDesk."
        actions={
          <>
            <Badge variant="outline">REST API v1</Badge>
            <GenerateKeyDialog />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active keys</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{activeKeys.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Expiring soon</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{expiringSoonKeys.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Expired</p>
            <p className="mt-1 text-2xl font-bold text-muted-foreground">{expiredKeys.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Revoked</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{revokedKeys.length}</p>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">API keys</h2>
              <p className="text-sm text-muted-foreground">
                Keys are shown once when generated. Store them in the calling system&apos;s secret manager.
              </p>
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Key</TableHead>
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
                  const status = getKeyStatus(key);
                  const expiresAt = key.expiresAt ? new Date(key.expiresAt) : null;
                  const daysUntilExpiry = getDaysUntil(expiresAt);

                  return (
                    <TableRow key={key.id}>
                      <TableCell>
                        <div className="font-medium">{key.name}</div>
                        {status === "active" && daysUntilExpiry !== null && daysUntilExpiry <= 14 ? (
                          <div className="text-xs text-amber-600">
                            Rotate within {Math.max(daysUntilExpiry, 0)} day{daysUntilExpiry === 1 ? "" : "s"}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{key.prefix}...</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(key.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {expiresAt ? format(expiresAt, "MMM d, yyyy") : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === "active" ? "default" :
                              status === "expired" ? "secondary" : "destructive"
                          }
                          className={
                            status === "expired"
                              ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                              : ""
                          }
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Authentication</p>
              <p className="mt-1 text-muted-foreground">
                Send every request with a bearer token. Missing, revoked, or expired keys return 401.
              </p>
              <code className="mt-2 block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
                Authorization: Bearer sd_live_...
              </code>
            </div>
            <div>
              <p className="font-medium">Rotation</p>
              <p className="mt-1 text-muted-foreground">
                Create a replacement key, deploy it to the external system, confirm traffic, then revoke the old key.
              </p>
            </div>
            <div>
              <p className="font-medium">Requester rule</p>
              <p className="mt-1 text-muted-foreground">
                SalamDesk blocks duplicate active tickets for the same requester to keep support queues clean.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5 border-t pt-8">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Integration reference</h2>
            <p className="text-sm text-muted-foreground">
              Use these endpoints when another system needs to open tickets, check status, or push updates.
            </p>
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            Base URL: <code>https://&lt;your-domain&gt;</code>
          </div>
        </div>

        <div className="grid gap-5">
          {endpoints.map((endpoint) => (
            <Card key={`${endpoint.method}-${endpoint.path}`}>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={endpoint.tone}>{endpoint.method}</Badge>
                  <code className="rounded-md bg-muted px-2 py-1 text-sm font-semibold">
                    {endpoint.path}
                  </code>
                </div>
                <div>
                  <CardTitle className="text-base">{endpoint.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{endpoint.description}</p>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Example {endpoint.method === "GET" ? "response" : "body"}
                  </p>
                  <pre className="overflow-x-auto text-xs leading-relaxed">
                    <code>{endpoint.body}</code>
                  </pre>
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium">Required</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {endpoint.required.map((field) => (
                        <Badge key={field} variant="outline">{field}</Badge>
                      ))}
                    </div>
                  </div>
                  {endpoint.optional.length ? (
                    <div>
                      <p className="font-medium">Optional</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {endpoint.optional.map((field) => (
                          <Badge key={field} variant="secondary">{field}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <p className="font-medium">Common responses</p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {endpoint.responses.map((response) => (
                        <li key={response}>{response}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
