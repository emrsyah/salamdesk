export default function UsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manajemen pengguna dan role</p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-muted-foreground">
          Manajemen user akan diimplementasikan dengan fitur:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>List dan tambah user</li>
          <li>Assign role dan permission</li>
          <li>User profile management</li>
          <li>Deactivate/delete user</li>
        </ul>
      </div>
    </div>
  )
}
