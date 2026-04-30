"use client"

import { useQueryParams } from "@/hooks/use-query-params"

export default function AnalyticPage() {
    const { searchParams } = useQueryParams()

    // Get query params from URL
    const range = searchParams.get("range") || "7d"
    const module = searchParams.get("module")

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Analytics</h1>
                <p className="text-muted-foreground">
                    Dashboard analitik dan metrik tiket
                </p>
            </div>

            <div className="rounded-lg border p-4">
                <h2 className="mb-2 font-semibold">Current Query State</h2>
                <div className="space-y-1 text-sm text-muted-foreground">
                    <div>
                        Range: <span className="font-mono text-foreground">{range}</span>
                    </div>
                    {module && (
                        <div>
                            Module:{" "}
                            <span className="font-mono text-foreground">{module}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-lg border p-4">
                <p className="text-muted-foreground">
                    Dashboard analitik akan diimplementasikan dengan fitur:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    <li>Chart volume tiket per hari/minggu/bulan</li>
                    <li>Statistik SLA</li>
                    <li>Distribusi priority</li>
                    <li>Performance tim support</li>
                    <li>Filter berdasarkan module</li>
                </ul>
            </div>
        </div>
    )
}
