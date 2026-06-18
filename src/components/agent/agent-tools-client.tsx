"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RiAddLine, RiDeleteBinLine, RiFlaskLine, RiToolsLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AgentTabIntro, StatusPill } from "./agent-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Credential = { id: string; name: string; kind: string };
type ToolItem = {
  id: string;
  name: string;
  description: string;
  type: string;
  config: unknown;
  credentialId: string | null;
  enabled: boolean;
};

type HttpParam = { name: string; in: "query" | "path" | "body"; type: "string" | "number" | "boolean"; required: boolean };

const EMPTY_HTTP = {
  method: "GET",
  urlTemplate: "https://",
  headers: {} as Record<string, string>,
  params: [] as HttpParam[],
  bodyTemplate: "",
  responseJsonPath: "",
};

export function AgentToolsClient({
  tools,
  credentials,
}: {
  tools: ToolItem[];
  credentials: Credential[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ToolItem | "new" | null>(null);
  const [credOpen, setCredOpen] = useState(false);

  async function toggleEnabled(tool: ToolItem, enabled: boolean) {
    try {
      const { updateToolAction } = await import("@/actions/agent.actions");
      await updateToolAction(tool.id, { enabled });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui");
    }
  }

  async function removeTool(tool: ToolItem) {
    try {
      const { deleteToolAction } = await import("@/actions/agent.actions");
      await deleteToolAction(tool.id);
      toast.success("Tool dihapus");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  }

  const enabledCount = tools.filter((t) => t.enabled).length;

  return (
    <div className="space-y-6">
      <AgentTabIntro
        icon={<RiToolsLine className="size-5" />}
        title="Tools"
        description="Integrasi yang bisa dipanggil agen saat menjalankan Prosedur — API kustom (HTTP) dan pencarian web (Exa). Deskripsi tiap tool dibaca AI untuk memutuskan kapan memakainya."
      >
        <StatusPill on={enabledCount > 0} label={`${enabledCount}/${tools.length} aktif`} />
      </AgentTabIntro>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Daftar tool</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCredOpen(true)}>
            Kredensial
          </Button>
          <Button className="gap-1.5" onClick={() => setEditing("new")}>
            <RiAddLine className="size-4" /> Tambah Tool
          </Button>
        </div>
      </div>

      {tools.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Belum ada tool. Tambahkan API kustom atau Exa web search.
        </div>
      ) : (
        <div className="space-y-2">
          {tools.map((tool) => (
            <div key={tool.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{tool.name}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {tool.type === "exa_search" ? "Exa" : "HTTP"}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{tool.description}</p>
              </div>
              <Switch
                checked={tool.enabled}
                onCheckedChange={(v) => toggleEnabled(tool, v)}
                aria-label={`Aktifkan ${tool.name}`}
              />
              <Button variant="ghost" size="sm" onClick={() => setEditing(tool)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:bg-destructive/10"
                onClick={() => removeTool(tool)}
                aria-label={`Hapus ${tool.name}`}
              >
                <RiDeleteBinLine className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ToolEditor
          tool={editing === "new" ? null : editing}
          credentials={credentials}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {credOpen && (
        <CredentialsDialog
          credentials={credentials}
          onClose={() => setCredOpen(false)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

function ToolEditor({
  tool,
  credentials,
  onClose,
  onSaved,
}: {
  tool: ToolItem | null;
  credentials: Credential[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isExa = (tool?.type ?? "http") === "exa_search";
  const [type, setType] = useState<string>(tool?.type ?? "http");
  const [name, setName] = useState(tool?.name ?? "");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [credentialId, setCredentialId] = useState<string | null>(tool?.credentialId ?? null);
  const [http, setHttp] = useState({ ...EMPTY_HTTP, ...((tool && !isExa ? (tool.config as object) : {}) as typeof EMPTY_HTTP) });
  const [numResults, setNumResults] = useState<number>(
    tool && isExa ? ((tool.config as { numResults?: number }).numResults ?? 5) : 5,
  );
  const [saving, setSaving] = useState(false);
  const [testArgs, setTestArgs] = useState("{}");
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || !description.trim()) {
      toast.error("Nama dan deskripsi wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const config = type === "exa_search" ? { numResults } : http;
      const actions = await import("@/actions/agent.actions");
      if (tool) {
        await actions.updateToolAction(tool.id, { name, description, type, config, credentialId });
      } else {
        await actions.createToolAction({ name, description, type, config, credentialId });
      }
      toast.success("Tool disimpan");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!tool) {
      toast.error("Simpan dulu sebelum menguji.");
      return;
    }
    setTestResult(null);
    try {
      const parsed = JSON.parse(testArgs || "{}");
      const { testToolAction } = await import("@/actions/agent.actions");
      const result = await testToolAction(tool.id, parsed);
      setTestResult(JSON.stringify(result, null, 2));
    } catch (e) {
      setTestResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const setParam = (i: number, patch: Partial<HttpParam>) =>
    setHttp((h) => ({ ...h, params: h.params.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tool ? "Edit Tool" : "Tambah Tool"}</DialogTitle>
          <DialogDescription>
            Deskripsi dibaca AI untuk memutuskan kapan memanggil tool ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipe</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="http">HTTP API kustom</option>
              <option value="exa_search">Exa web search</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tool-name">Nama</Label>
            <Input id="tool-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="get_order_info" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tool-desc">Deskripsi</Label>
            <Textarea
              id="tool-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ambil detail pesanan dari sistem berdasarkan ID pesanan."
            />
          </div>

          {type === "exa_search" ? (
            <div className="space-y-1.5">
              <Label htmlFor="numResults">Jumlah hasil</Label>
              <Input
                id="numResults"
                type="number"
                min={1}
                max={10}
                className="w-24"
                value={numResults}
                onChange={(e) => setNumResults(Number(e.target.value))}
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={http.method}
                    onChange={(e) => setHttp((h) => ({ ...h, method: e.target.value }))}
                  >
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>URL (boleh pakai {"{placeholder}"})</Label>
                  <Input
                    value={http.urlTemplate}
                    onChange={(e) => setHttp((h) => ({ ...h, urlTemplate: e.target.value }))}
                    placeholder="https://api.example.com/orders/{id}"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Parameter</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setHttp((h) => ({
                        ...h,
                        params: [...h.params, { name: "", in: "query", type: "string", required: false }],
                      }))
                    }
                  >
                    + Param
                  </Button>
                </div>
                {http.params.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input
                      className="w-36"
                      placeholder="nama"
                      value={p.name}
                      onChange={(e) => setParam(i, { name: e.target.value })}
                    />
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={p.in}
                      onChange={(e) => setParam(i, { in: e.target.value as HttpParam["in"] })}
                    >
                      <option value="query">query</option>
                      <option value="path">path</option>
                      <option value="body">body</option>
                    </select>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={p.type}
                      onChange={(e) => setParam(i, { type: e.target.value as HttpParam["type"] })}
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={p.required}
                        onChange={(e) => setParam(i, { required: e.target.checked })}
                      />
                      wajib
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setHttp((h) => ({ ...h, params: h.params.filter((_, idx) => idx !== i) }))}
                    >
                      Hapus
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>Body template (opsional)</Label>
                <Textarea
                  value={http.bodyTemplate}
                  onChange={(e) => setHttp((h) => ({ ...h, bodyTemplate: e.target.value }))}
                  placeholder={'{"orderId": "{id}"}'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Response JSON path (opsional)</Label>
                <Input
                  value={http.responseJsonPath}
                  onChange={(e) => setHttp((h) => ({ ...h, responseJsonPath: e.target.value }))}
                  placeholder="data.order"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kredensial (opsional)</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={credentialId ?? ""}
                  onChange={(e) => setCredentialId(e.target.value || null)}
                >
                  <option value="">Tanpa kredensial</option>
                  {credentials.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.kind})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Test runner */}
          {tool && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label className="flex items-center gap-1.5">
                <RiFlaskLine className="size-4" /> Uji tool
              </Label>
              <Textarea
                className="font-mono text-xs"
                value={testArgs}
                onChange={(e) => setTestArgs(e.target.value)}
                placeholder='{"query": "..."}'
              />
              <Button type="button" variant="outline" size="sm" onClick={handleTest}>
                Jalankan uji
              </Button>
              {testResult && (
                <pre className="max-h-48 overflow-auto rounded bg-background p-2 text-xs">{testResult}</pre>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({
  credentials,
  onClose,
  onChanged,
}: {
  credentials: Credential[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("bearer");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim() || !secret.trim()) {
      toast.error("Nama dan secret wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const { createCredentialAction } = await import("@/actions/agent.actions");
      await createCredentialAction({ name, kind, secret });
      toast.success("Kredensial ditambahkan");
      setName("");
      setSecret("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah kredensial");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      const { deleteCredentialAction } = await import("@/actions/agent.actions");
      await deleteCredentialAction(id);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kredensial</DialogTitle>
          <DialogDescription>
            Secret dienkripsi di server dan tidak pernah ditampilkan kembali.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada kredensial.</p>
          ) : (
            credentials.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  {c.name} <span className="text-muted-foreground">({c.kind})</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:bg-destructive/10"
                  onClick={() => remove(c.id)}
                  aria-label={`Hapus ${c.name}`}
                >
                  <RiDeleteBinLine className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama (mis. Stripe key)" />
          <div className="flex gap-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="bearer">Bearer token</option>
              <option value="api_key_header">API key header</option>
              <option value="basic">Basic auth</option>
            </select>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={kind === "api_key_header" ? "X-Api-Key:nilai" : "secret"}
            />
          </div>
          {kind === "api_key_header" && (
            <p className="text-xs text-muted-foreground">Format: NamaHeader:nilai</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          <Button onClick={add} disabled={saving}>
            {saving ? "Menyimpan…" : "Tambah kredensial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
