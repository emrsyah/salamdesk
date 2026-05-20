"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const ticketTrend = [
  { day: "Sen", created: 24, resolved: 18 },
  { day: "Sel", created: 31, resolved: 27 },
  { day: "Rab", created: 28, resolved: 25 },
  { day: "Kam", created: 42, resolved: 35 },
  { day: "Jum", created: 38, resolved: 36 },
  { day: "Sab", created: 15, resolved: 14 },
  { day: "Min", created: 9, resolved: 9 },
]

const responseTime = [
  { week: "W1", avg: 42 },
  { week: "W2", avg: 38 },
  { week: "W3", avg: 31 },
  { week: "W4", avg: 28 },
  { week: "W5", avg: 24 },
  { week: "W6", avg: 22 },
]

const statusDist = [
  { name: "open", label: "Open", value: 48 },
  { name: "progress", label: "In Progress", value: 32 },
  { name: "resolved", label: "Resolved", value: 86 },
  { name: "closed", label: "Closed", value: 54 },
]

const channelDist = [
  { channel: "WhatsApp", tickets: 124 },
  { channel: "Email", tickets: 86 },
  { channel: "Web", tickets: 52 },
  { channel: "Manual", tickets: 31 },
  { channel: "API", tickets: 18 },
]

const agentPerf = [
  { name: "Rizki", resolved: 42, assigned: 50 },
  { name: "Sari", resolved: 38, assigned: 41 },
  { name: "Andi", resolved: 31, assigned: 38 },
  { name: "Nia", resolved: 28, assigned: 30 },
  { name: "Budi", resolved: 22, assigned: 28 },
]

const summary = [
  { label: "Total Tiket", value: 220, delta: "+12%", color: "text-blue-600" },
  { label: "Open", value: 80, delta: "+4%", color: "text-amber-600" },
  { label: "Resolved (7d)", value: 164, delta: "+18%", color: "text-green-600" },
  { label: "Avg Response", value: "22m", delta: "-8m", color: "text-purple-600" },
]

const trendConfig = {
  created: { label: "Dibuat", color: "var(--chart-1)" },
  resolved: { label: "Resolved", color: "var(--chart-2)" },
} satisfies ChartConfig

const statusConfig = {
  value: { label: "Tiket" },
  open: { label: "Open", color: "var(--chart-1)" },
  progress: { label: "In Progress", color: "var(--chart-3)" },
  resolved: { label: "Resolved", color: "var(--chart-2)" },
  closed: { label: "Closed", color: "var(--chart-5)" },
} satisfies ChartConfig

const channelConfig = {
  tickets: { label: "Tiket", color: "var(--chart-4)" },
} satisfies ChartConfig

const responseConfig = {
  avg: { label: "Menit", color: "var(--chart-5)" },
} satisfies ChartConfig

const agentConfig = {
  assigned: { label: "Ditangani", color: "var(--chart-3)" },
  resolved: { label: "Resolved", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function DashboardPage() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Ringkasan performa helpdesk (data dummy)</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summary.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <span className="text-xs text-muted-foreground">{c.delta}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Tren Tiket (7 Hari)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="aspect-auto h-[260px] w-full">
              <AreaChart data={ticketTrend} margin={{ left: 4, right: 12, top: 8 }}>
                <defs>
                  <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-created)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--color-created)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-resolved)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--color-resolved)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="var(--color-created)"
                  fill="url(#fillCreated)"
                  strokeWidth={2}
                  stackId="a"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stroke="var(--color-resolved)"
                  fill="url(#fillResolved)"
                  strokeWidth={2}
                  stackId="b"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={statusConfig} className="mx-auto aspect-square h-[260px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                <Pie
                  data={statusDist}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  strokeWidth={2}
                >
                  {statusDist.map((e) => (
                    <Cell key={e.name} fill={`var(--color-${e.name})`} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiket per Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={channelConfig} className="aspect-auto h-[260px] w-full">
              <BarChart data={channelDist} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="channel" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <Bar dataKey="tickets" fill="var(--color-tickets)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rata-rata Waktu Respon (menit)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={responseConfig} className="aspect-auto h-[260px] w-full">
              <LineChart data={responseTime} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="var(--color-avg)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--color-avg)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performa Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={agentConfig} className="aspect-auto h-[280px] w-full">
            <BarChart data={agentPerf} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="assigned" fill="var(--color-assigned)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="resolved" fill="var(--color-resolved)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
