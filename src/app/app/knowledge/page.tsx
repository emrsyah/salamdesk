export default function KnowledgePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Halaman pengetahuan dan dokumentasi
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-muted-foreground">
          Knowledge base akan diimplementasikan dengan fitur:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Pencarian artikel</li>
          <li>Kategori pengetahuan</li>
          <li>Tag dan filtering</li>
          <li>View dan edit artikel</li>
        </ul>
      </div>
    </div>
  )
}
