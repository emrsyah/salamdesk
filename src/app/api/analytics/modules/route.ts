import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { getCachedActiveModules } from "@/lib/cache"

export async function GET() {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const modules = await getCachedActiveModules()
  return NextResponse.json(modules.map((m) => ({ id: m.id, name: m.name })))
}
