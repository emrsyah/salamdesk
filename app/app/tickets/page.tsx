"use client"

import { useQueryParams } from "@/hooks/use-query-params"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
    RiSearchLine,
    RiInboxLine,
    RiTimerLine,
    RiCheckLine,
    RiUserLine,
    RiMore2Fill,
    RiSparklingFill
} from "@remixicon/react"

export default function TicketsPage() {
    const { searchParams, setQueryParam } = useQueryParams()

    // Get query params from URL
    const tab = searchParams.get("tab") || "inbox"
    const assignee = searchParams.get("assignee")
    const priority = searchParams.get("priority")
    const sla = searchParams.get("sla")
    const module = searchParams.get("module")
    const resolvedBy = searchParams.get("resolvedBy")
    const selected = searchParams.get("selected")

    const handleTabChange = (value: string) => {
        setQueryParam("tab", value)
    }

    return (
        <div className="flex h-full w-full bg-background overflow-hidden">
            {/* Left Pane - List */}
            <div className="flex w-80 md:w-96 flex-col border-r shrink-0 h-full bg-background">
                {/* Header */}
                <div className="flex items-center justify-between p-4 pb-2">
                    <h1 className="text-xl font-bold">Inbox</h1>
                    <span className="text-xs text-muted-foreground">1 tiket</span>
                </div>

                {/* Search */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <RiSearchLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Cari tiket, pelapor, modul..."
                            className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background h-9 rounded-md shadow-none"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <Tabs value={tab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 border-b">
                        <TabsList variant="line" className="w-full justify-start h-auto bg-transparent p-0 gap-4">
                            <TabsTrigger
                                value="inbox"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-3 pt-2 shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground"
                            >
                                Inbox <span className="ml-1.5 text-xs text-muted-foreground">6</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="waiting"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-3 pt-2 shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground"
                            >
                                Menunggu <span className="ml-1.5 text-xs text-orange-500 font-semibold">1</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="done"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-3 pt-2 shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground"
                            >
                                Selesai <span className="ml-1.5 text-xs text-muted-foreground">5</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tab Contents - Scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        <TabsContent value="inbox" className="p-0 m-0 border-none outline-none">
                            {/* Mock Ticket Item 1 */}
                            <div className="p-4 border-l-4 border-l-primary border-b cursor-pointer bg-muted/20 hover:bg-muted/50 transition-colors">
                                <div className="flex justify-between items-start mb-1.5">
                                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        TKT-2836 <RiInboxLine className="size-3.5" />
                                    </div>
                                    <span className="text-xs text-muted-foreground">2 jam</span>
                                </div>
                                <h3 className="font-semibold text-sm leading-snug mb-3 pr-2">Cetak struk kasir tidak keluar — printer offline</h3>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Yuni Lestari</span>
                                    <div className="flex gap-2 items-center">
                                        <span className="flex items-center gap-1.5 font-medium"><div className="size-2 rounded-sm bg-orange-500" /> Billing</span>
                                        <span className="flex items-center gap-1 text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded"><RiTimerLine className="size-3" /> 120 / 60 m</span>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="waiting" className="p-0 m-0 border-none outline-none">
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                Tidak ada tiket menunggu.
                            </div>
                        </TabsContent>

                        <TabsContent value="done" className="p-0 m-0 border-none outline-none">
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                Tidak ada tiket selesai.
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* Right Pane - Detail */}
            <div className="flex-1 overflow-y-auto bg-background p-0 h-full flex flex-col">
                {/* Detail Header */}
                <div className="sticky top-0 bg-background border-b z-10 p-6 pb-4">
                    <div className="max-w-4xl mx-auto flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                <span className="font-medium text-foreground/70">TKT-2841</span>
                                <span>•</span>
                                <span>Billing</span>
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">SEP BPJS tidak ter-generate, antrian pasien menumpuk</h2>
                            <div className="flex items-center gap-3 pt-3 text-xs">
                                <span className="flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 font-medium border border-blue-200/50"><div className="size-1.5 rounded-full bg-blue-500" /> Terbuka</span>
                                <span className="text-red-600 font-medium bg-red-50 px-2 py-1 rounded border border-red-200/50">Kritis</span>
                                <span className="flex items-center gap-1.5 text-muted-foreground ml-1"><RiInboxLine className="size-3.5" /> WhatsApp</span>
                                <span className="text-muted-foreground flex items-center gap-1.5"><RiUserLine className="size-3.5" /> Yuni Lestari • Kasir Lt.1</span>
                                <span className="flex items-center gap-1.5 text-green-600 font-medium ml-1"><RiTimerLine className="size-3.5" /> SLA 8 / 15 mnt</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="flex items-center justify-center size-9 rounded-md border text-muted-foreground hover:bg-muted transition-colors"><RiUserLine className="size-4" /></button>
                            <button className="px-4 py-2 text-sm border rounded-md hover:bg-muted font-medium transition-colors">Eskalasi</button>
                            <button className="px-4 py-2 text-sm bg-yellow-400 text-yellow-950 rounded-md hover:bg-yellow-500 font-medium flex items-center gap-1.5 transition-colors"><RiCheckLine className="size-4" /> Selesai</button>
                        </div>
                    </div>
                </div>

                {/* Detail Content */}
                <div className="flex-1 p-6">
                    <div className="max-w-4xl mx-auto space-y-6">

                        {/* AI Suggestion Alert */}
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded bg-yellow-400 p-1 text-yellow-950">
                                    <RiSparklingFill className="size-4" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-yellow-900 mb-1">SARAN AI</h4>
                                    <p className="text-sm text-yellow-800">
                                        User melaporkan SEP gagal generate sejak 08:15 WIB. Kode error 504. AI mendeteksi kemungkinan masalah serupa dengan KB-2.
                                    </p>
                                </div>
                                <button className="text-yellow-600 hover:text-yellow-800">
                                    <RiMore2Fill className="size-5" />
                                </button>
                            </div>
                        </div>

                        {/* Existing Query State (Kept for functionality testing) */}
                        <div className="rounded-lg border p-5">
                            <h3 className="mb-3 font-semibold border-b pb-2">Current Query State</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
                                <div>Tab: <span className="font-mono text-foreground">{tab}</span></div>
                                {assignee && <div>Assignee: <span className="font-mono text-foreground">{assignee}</span></div>}
                                {priority && <div>Priority: <span className="font-mono text-foreground">{priority}</span></div>}
                                {sla && <div>SLA: <span className="font-mono text-foreground">{sla}</span></div>}
                                {module && <div>Module: <span className="font-mono text-foreground">{module}</span></div>}
                                {resolvedBy && <div>Resolved By: <span className="font-mono text-foreground">{resolvedBy}</span></div>}
                                {selected && <div>Selected Ticket: <span className="font-mono text-foreground">{selected}</span></div>}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}
