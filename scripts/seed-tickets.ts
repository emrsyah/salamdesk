import "dotenv/config";
import { db } from "@/db";
import { modules, slaConfigs } from "@/db/schema/modules";
import { tickets, ticketMessages, ticketEscalations } from "@/db/schema/tickets";
import { users } from "@/db/schema/users";
import { and, eq } from "drizzle-orm";
import { findOrCreateRequesterByIdentity } from "@/services/requester.service";

type Priority = "low" | "medium" | "critical";
type Status = "open" | "in_progress" | "waiting" | "resolved" | "closed";
type Source = "whatsapp" | "web" | "email" | "manual" | "api";
type RootCause = "bug" | "user_error" | "network" | "third_party" | "configuration" | "hardware" | "other";

type Reply = { from: "user" | "agent" | "ai_bot" | "system"; content: string; internal?: boolean };

type TicketSeed = {
  title: string;
  description: string;
  moduleSlug: string;
  priority: Priority;
  status: Status;
  source: Source;
  waPhone?: string;
  reporterName: string;
  reporterEmail: string;
  rootCause?: RootCause;
  resolutionNote?: string;
  daysAgo: number; // when created
  replies?: Reply[];
  slaState?: "safe" | "warning" | "breached";
  escalated?: boolean;
};

const REPORTERS: Array<{ name: string; email: string; phone: string }> = [
  { name: "Dr. Rina Wulandari", email: "rina.wulandari@rs-sehat.id", phone: "+6281234567801" },
  { name: "Ns. Budi Hartono", email: "budi.hartono@rs-sehat.id", phone: "+6281234567802" },
  { name: "Apt. Siti Aminah", email: "siti.aminah@rs-sehat.id", phone: "+6281234567803" },
  { name: "Pak Joko Susilo (Kasir)", email: "joko.susilo@rs-sehat.id", phone: "+6281234567804" },
  { name: "Bu Lestari (Pendaftaran)", email: "lestari@rs-sehat.id", phone: "+6281234567805" },
  { name: "Dr. Anton Pratama", email: "anton.pratama@rs-sehat.id", phone: "+6281234567806" },
  { name: "Ns. Maya Sari", email: "maya.sari@rs-sehat.id", phone: "+6281234567807" },
  { name: "Pak Rahmat (Radiologi)", email: "rahmat@rs-sehat.id", phone: "+6281234567808" },
  { name: "Bu Dewi (Lab)", email: "dewi@rs-sehat.id", phone: "+6281234567809" },
  { name: "Pak Hendra (Rekam Medis)", email: "hendra@rs-sehat.id", phone: "+6281234567810" },
];

const TICKETS: TicketSeed[] = [
  {
    title: "Tidak bisa input pasien baru di IGD",
    description: "Form pendaftaran pasien IGD muncul error 'NIK sudah terdaftar' padahal pasien baru pertama kali datang. Sudah refresh tapi tetap sama. Pasien menunggu di triage.",
    moduleSlug: "igd",
    priority: "critical",
    status: "in_progress",
    source: "whatsapp",
    reporterName: REPORTERS[0].name,
    reporterEmail: REPORTERS[0].email,
    waPhone: REPORTERS[0].phone,
    daysAgo: 0,
    slaState: "warning",
    replies: [
      { from: "ai_bot", content: "Halo Dr. Rina, dari log sistem terlihat NIK tersebut tercatat di database lama hasil migrasi 2023. Coba gunakan tombol 'Override NIK' di sebelah kanan form. Kami eskalasi ke tim engineer juga." },
      { from: "agent", content: "Sudah saya cek di DB, ada duplicate row dari import lama. Sedang dibersihkan sekarang, mohon ditunggu 5 menit." },
      { from: "user", content: "Baik pak, pasien sudah masuk antrian observasi sementara." },
    ],
  },
  {
    title: "Resep elektronik tidak terkirim ke Farmasi",
    description: "Saya sudah submit resep dari poli interna jam 09:15 untuk pasien Tn. Subagio (RM 0091234), tapi di Farmasi belum muncul. Sudah submit ulang 2x.",
    moduleSlug: "farmasi",
    priority: "critical",
    status: "open",
    source: "whatsapp",
    reporterName: REPORTERS[5].name,
    reporterEmail: REPORTERS[5].email,
    waPhone: REPORTERS[5].phone,
    daysAgo: 0,
    slaState: "breached",
    replies: [
      { from: "ai_bot", content: "Saya cek queue Farmasi - terlihat ada 47 resep stuck di status 'pending_send'. Kemungkinan service e-prescription gateway down. Tim teknis sudah dinotifikasi." },
    ],
    escalated: true,
  },
  {
    title: "Tagihan BPJS muncul double untuk pasien rawat inap",
    description: "Pasien Ny. Hartini (RM 0087765) tagihan BPJS-nya muncul 2x di sistem billing. Total jadi Rp 4.5 juta padahal seharusnya 2.25 juta. Pasien sudah komplain.",
    moduleSlug: "billing",
    priority: "medium",
    status: "in_progress",
    source: "web",
    reporterName: REPORTERS[3].name,
    reporterEmail: REPORTERS[3].email,
    daysAgo: 1,
    replies: [
      { from: "agent", content: "Sudah saya identifikasi - ada race condition saat closing tagihan bersamaan dengan checkout rawat inap. Sedang dibatalkan salah satunya." },
      { from: "user", content: "Mohon segera pak, pasien menunggu di kasir." },
      { from: "agent", content: "Selesai. Silakan refresh halaman billing. Total sudah jadi Rp 2.250.000.", internal: false },
    ],
  },
  {
    title: "Printer label sampel di Lab tidak terdeteksi",
    description: "Printer Zebra di Lab Sentral hari ini tidak mau print label barcode. Sudah restart printer dan PC, tetap tidak terdeteksi di sistem LIS.",
    moduleSlug: "laboratorium",
    priority: "medium",
    status: "resolved",
    source: "whatsapp",
    reporterName: REPORTERS[8].name,
    reporterEmail: REPORTERS[8].email,
    waPhone: REPORTERS[8].phone,
    daysAgo: 2,
    rootCause: "hardware",
    resolutionNote: "Driver printer corrupt setelah Windows update. Install ulang driver Zebra ZD420 dari portal IT. Done.",
    replies: [
      { from: "ai_bot", content: "Coba cek di Device Manager apakah printer ada tanda kuning? Kemungkinan driver issue setelah update Windows kemarin." },
      { from: "user", content: "Bener pak, ada tanda seru kuning." },
      { from: "agent", content: "Saya remote sebentar ya, install ulang drivernya." },
      { from: "user", content: "Sudah jalan, makasih banyak!" },
    ],
  },
  {
    title: "Hasil radiologi tidak masuk ke EMR pasien",
    description: "Hasil thorax X-ray pasien RM 0088901 sudah dibaca dr. Sp.Rad tapi tidak muncul di EMR dokter pengirim. PACS sudah ada filenya.",
    moduleSlug: "radiologi",
    priority: "medium",
    status: "waiting",
    source: "email",
    reporterName: REPORTERS[7].name,
    reporterEmail: REPORTERS[7].email,
    daysAgo: 1,
    replies: [
      { from: "agent", content: "Sedang koordinasi dengan vendor PACS untuk cek integrasi HL7. Menunggu response dari vendor (tiket di Synapse #2241)." },
    ],
  },
  {
    title: "Tidak bisa booking jadwal poli online",
    description: "Pasien telpon bilang aplikasi mobile JKN error saat booking poli mata. Pesan: 'Service unavailable'.",
    moduleSlug: "rawat-jalan",
    priority: "medium",
    status: "in_progress",
    source: "whatsapp",
    reporterName: REPORTERS[4].name,
    reporterEmail: REPORTERS[4].email,
    waPhone: REPORTERS[4].phone,
    daysAgo: 0,
    replies: [
      { from: "ai_bot", content: "Saya cek - endpoint /booking/v2 returning 503. Bridging BPJS Mobile JKN sedang ada gangguan dari pusat (https://status.bpjs-kesehatan.go.id). ETA recovery 1 jam." },
    ],
  },
  {
    title: "Stok obat di Farmasi tidak update setelah dispensing",
    description: "Setelah obat diberikan ke pasien, stok di sistem tidak berkurang. Jadi tidak akurat untuk stock opname.",
    moduleSlug: "farmasi",
    priority: "low",
    status: "open",
    source: "web",
    reporterName: REPORTERS[2].name,
    reporterEmail: REPORTERS[2].email,
    daysAgo: 3,
  },
  {
    title: "Bed management rawat inap menampilkan bed kosong padahal terisi",
    description: "Di dashboard bed monitor, kamar 305A terlihat 'available' tapi sebenarnya sudah ada pasien sejak kemarin sore.",
    moduleSlug: "rawat-inap",
    priority: "medium",
    status: "resolved",
    source: "manual",
    reporterName: REPORTERS[1].name,
    reporterEmail: REPORTERS[1].email,
    daysAgo: 4,
    rootCause: "user_error",
    resolutionNote: "Petugas admisi lupa update status bed saat transfer dari IGD. Sudah edukasi SOP transfer pasien.",
    replies: [
      { from: "agent", content: "Saya cek log - status bed tidak pernah di-set ke 'occupied' saat pasien transfer dari IGD. Kemungkinan miss klik petugas admisi." },
      { from: "user", content: "Oh iya benar, kemarin petugasnya yang baru. Akan kami briefing ulang." },
    ],
  },
  {
    title: "Permintaan akses modul Rekam Medis untuk koas baru",
    description: "Mohon dibuatkan akun untuk 12 koas yang mulai stase minggu depan. List nama menyusul via email.",
    moduleSlug: "rekam-medis",
    priority: "low",
    status: "waiting",
    source: "email",
    reporterName: REPORTERS[9].name,
    reporterEmail: REPORTERS[9].email,
    daysAgo: 2,
    replies: [
      { from: "agent", content: "Siap, mohon dikirim list lengkap (nama, NIM, NIK) dan surat dari koordinator pendidikan. Standar onboarding kami sertakan training EMR 1 jam." },
    ],
  },
  {
    title: "Hasil lab kritis tidak memunculkan alert",
    description: "Hasil Hb 4.2 g/dL pasien IGD seharusnya muncul alert merah ke DPJP, tapi cuma muncul biasa. Bahaya kalau terlewat.",
    moduleSlug: "laboratorium",
    priority: "critical",
    status: "in_progress",
    source: "whatsapp",
    reporterName: REPORTERS[8].name,
    reporterEmail: REPORTERS[8].email,
    waPhone: REPORTERS[8].phone,
    daysAgo: 0,
    slaState: "warning",
    replies: [
      { from: "ai_bot", content: "Threshold critical value untuk Hb di sistem masih 5.0 (settingan lama). Standar baru 2024 adalah <7.0 untuk dewasa. Recommend update config. Saya eskalasi ke admin clinical config." },
      { from: "agent", content: "Bener, threshold belum diupdate sesuai PNPK terbaru. Sedang dikoordinasikan dengan Komite Medik untuk approval update." },
    ],
    escalated: true,
  },
  {
    title: "Laporan bulanan kunjungan tidak bisa di-export",
    description: "Tombol export Excel di laporan kunjungan rawat jalan tidak respond. Sudah coba 3 browser berbeda.",
    moduleSlug: "rawat-jalan",
    priority: "low",
    status: "resolved",
    source: "web",
    reporterName: REPORTERS[4].name,
    reporterEmail: REPORTERS[4].email,
    daysAgo: 5,
    rootCause: "bug",
    resolutionNote: "Bug di backend report generator - timeout pada query >100k row. Sudah ditambahkan pagination + streaming. Released ke prod kemarin.",
  },
  {
    title: "Tidak bisa login ke sistem pagi ini",
    description: "Semua staf shift pagi tidak bisa login. Pesan: 'Authentication service unavailable'.",
    moduleSlug: "igd",
    priority: "critical",
    status: "closed",
    source: "whatsapp",
    reporterName: REPORTERS[0].name,
    reporterEmail: REPORTERS[0].email,
    waPhone: REPORTERS[0].phone,
    daysAgo: 7,
    rootCause: "configuration",
    resolutionNote: "SSL certificate auth server expired. Sudah renew dan auto-renewal di-setup. Post-mortem dishare ke team.",
    replies: [
      { from: "system", content: "Tiket di-eskalasi otomatis ke Engineer on-call karena SLA critical." },
      { from: "agent", content: "Certificate auth.salamdesk.local expired tadi malam jam 23:59. Sudah renew sekarang. Semua bisa login lagi." },
      { from: "user", content: "Confirmed, sudah bisa. Mohon ada monitoring expired cert ya pak biar tidak terulang." },
    ],
    escalated: true,
  },
  {
    title: "PACS viewer lambat sekali sore ini",
    description: "Buka CT-scan 1 series butuh >2 menit. Biasanya 5-10 detik.",
    moduleSlug: "radiologi",
    priority: "medium",
    status: "open",
    source: "whatsapp",
    reporterName: REPORTERS[7].name,
    reporterEmail: REPORTERS[7].email,
    waPhone: REPORTERS[7].phone,
    daysAgo: 0,
  },
  {
    title: "Permohonan template inform consent baru untuk tindakan endoskopi",
    description: "Tim GI minta template IC khusus untuk colonoscopy dan gastroscopy yang sesuai standar JCI.",
    moduleSlug: "rekam-medis",
    priority: "low",
    status: "in_progress",
    source: "email",
    reporterName: REPORTERS[9].name,
    reporterEmail: REPORTERS[9].email,
    daysAgo: 6,
  },
  {
    title: "Hasil EKG dari mesin baru tidak terintegrasi",
    description: "Mesin EKG GE MAC 2000 yang baru datang minggu lalu belum bisa kirim hasil otomatis ke EMR. Masih harus scan PDF manual.",
    moduleSlug: "rawat-jalan",
    priority: "medium",
    status: "waiting",
    source: "manual",
    reporterName: REPORTERS[6].name,
    reporterEmail: REPORTERS[6].email,
    daysAgo: 8,
    replies: [
      { from: "agent", content: "Sudah request vendor GE untuk integrasi MUSE -> HL7. Menunggu kontrak addendum dari purchasing." },
    ],
  },
  {
    title: "Tampilan billing pecah di tablet kasir",
    description: "Di tablet kasir Lt.1, kolom tagihan keluar dari layar. Harus scroll horizontal terus.",
    moduleSlug: "billing",
    priority: "low",
    status: "resolved",
    source: "whatsapp",
    reporterName: REPORTERS[3].name,
    reporterEmail: REPORTERS[3].email,
    waPhone: REPORTERS[3].phone,
    daysAgo: 9,
    rootCause: "bug",
    resolutionNote: "CSS responsive breakpoint untuk tablet 10\" belum di-handle. Fix di release v2.14.1.",
  },
  {
    title: "Pasien minta print ulang surat kontrol",
    description: "Pasien Bp. Wahyudi minta cetak ulang surat kontrol poli jantung tapi tombol cetak tidak muncul.",
    moduleSlug: "rawat-jalan",
    priority: "low",
    status: "closed",
    source: "manual",
    reporterName: REPORTERS[4].name,
    reporterEmail: REPORTERS[4].email,
    daysAgo: 10,
    rootCause: "user_error",
    resolutionNote: "User belum scroll ke bawah - tombol cetak ada di footer. Sudah ditunjukkan.",
  },
  {
    title: "Antrian poli tidak update real-time di TV display",
    description: "Display antrian di lobi poli stuck di nomor A047 sejak 30 menit lalu, padahal sudah panggil sampai A062.",
    moduleSlug: "rawat-jalan",
    priority: "medium",
    status: "open",
    source: "whatsapp",
    reporterName: REPORTERS[4].name,
    reporterEmail: REPORTERS[4].email,
    waPhone: REPORTERS[4].phone,
    daysAgo: 0,
    slaState: "safe",
  },
  {
    title: "Tidak ada notifikasi obat hampir habis",
    description: "Stok Paracetamol 500mg sudah <50 box tapi tidak ada notifikasi reorder. Threshold seharusnya 100.",
    moduleSlug: "farmasi",
    priority: "low",
    status: "in_progress",
    source: "web",
    reporterName: REPORTERS[2].name,
    reporterEmail: REPORTERS[2].email,
    daysAgo: 4,
  },
  {
    title: "Update jadwal dokter spesialis kandungan",
    description: "Dr. Sp.OG yang baru join butuh setup jadwal praktik Senin-Rabu-Jumat shift sore.",
    moduleSlug: "rawat-jalan",
    priority: "low",
    status: "resolved",
    source: "email",
    reporterName: REPORTERS[4].name,
    reporterEmail: REPORTERS[4].email,
    daysAgo: 11,
    rootCause: "other",
    resolutionNote: "Jadwal sudah di-setup. Quota 15 pasien/shift. Pasien sudah bisa booking dari Senin depan.",
  },
  {
    title: "WhatsApp gateway tidak kirim notifikasi hasil lab",
    description: "Pasien komplain belum dapat WA notifikasi hasil lab padahal sudah 2 jam validated.",
    moduleSlug: "laboratorium",
    priority: "medium",
    status: "in_progress",
    source: "whatsapp",
    reporterName: REPORTERS[8].name,
    reporterEmail: REPORTERS[8].email,
    waPhone: REPORTERS[8].phone,
    daysAgo: 0,
    replies: [
      { from: "ai_bot", content: "Saya cek queue WA gateway: ada 312 pesan pending. Kemungkinan rate limit dari Meta. Coba check dashboard WA Business." },
    ],
  },
  {
    title: "Permintaan akses laporan billing untuk auditor eksternal",
    description: "Auditor KAP butuh akses read-only ke laporan billing 2024 untuk audit tahunan.",
    moduleSlug: "billing",
    priority: "low",
    status: "waiting",
    source: "email",
    reporterName: REPORTERS[3].name,
    reporterEmail: REPORTERS[3].email,
    daysAgo: 3,
    replies: [
      { from: "agent", content: "Mohon dikirim surat permintaan resmi dari Direksi + NDA yang sudah ditandatangani. Akses akan dibuat sementara dengan masa berlaku 30 hari." },
    ],
  },
  {
    title: "EMR crash saat buka riwayat pasien lama (>5 tahun)",
    description: "Buka EMR pasien yang sudah lama (rawat inap 2019) selalu crash. Browser sampai not responding.",
    moduleSlug: "rekam-medis",
    priority: "medium",
    status: "open",
    source: "web",
    reporterName: REPORTERS[5].name,
    reporterEmail: REPORTERS[5].email,
    daysAgo: 1,
  },
  {
    title: "Permintaan tambah field alergi obat di registrasi IGD",
    description: "Untuk safety, di form pendaftaran IGD perlu ada field alergi obat yang mandatory.",
    moduleSlug: "igd",
    priority: "low",
    status: "waiting",
    source: "manual",
    reporterName: REPORTERS[1].name,
    reporterEmail: REPORTERS[1].email,
    daysAgo: 12,
    replies: [
      { from: "agent", content: "Request masuk backlog product. Akan dibahas di sprint planning minggu depan. Estimasi development 1 sprint." },
    ],
  },
  {
    title: "Mesin USG portabel tidak connect ke wifi RS",
    description: "USG portabel di ruang VK tidak bisa konek ke wifi 'RS-MEDIS'. Mesin lain bisa.",
    moduleSlug: "radiologi",
    priority: "medium",
    status: "resolved",
    source: "whatsapp",
    reporterName: REPORTERS[6].name,
    reporterEmail: REPORTERS[6].email,
    waPhone: REPORTERS[6].phone,
    daysAgo: 6,
    rootCause: "network",
    resolutionNote: "MAC address belum didaftarkan di whitelist wifi. Sudah didaftarkan via NAC. Auto-connect.",
  },
  {
    title: "Pemberitahuan: maintenance terjadwal Sabtu malam",
    description: "Akan ada maintenance database server Sabtu 22:00-02:00. Mohon disampaikan ke seluruh unit.",
    moduleSlug: "rekam-medis",
    priority: "low",
    status: "closed",
    source: "manual",
    reporterName: REPORTERS[9].name,
    reporterEmail: REPORTERS[9].email,
    daysAgo: 14,
    rootCause: "other",
    resolutionNote: "Maintenance selesai sukses. Downtime aktual 1 jam 20 menit. RTO terpenuhi.",
  },
  {
    title: "Triage AI memberikan saran modul yang salah",
    description: "Saya buat tiket tentang printer billing, malah di-assign ke modul Rawat Inap. Sudah 3x kejadian.",
    moduleSlug: "billing",
    priority: "low",
    status: "in_progress",
    source: "whatsapp",
    reporterName: REPORTERS[3].name,
    reporterEmail: REPORTERS[3].email,
    waPhone: REPORTERS[3].phone,
    daysAgo: 2,
    replies: [
      { from: "ai_bot", content: "Terima kasih feedback-nya. Kasus ini saya catat untuk retraining classifier. Confidence score saya untuk routing tiket Anda hanya 0.62 (di bawah threshold 0.75) - seharusnya minta konfirmasi manual." },
      { from: "agent", content: "Akan kita tambahkan keyword 'printer' + context 'kasir/billing' ke training set." },
    ],
  },
  {
    title: "Discharge summary tidak ter-generate otomatis",
    description: "Pasien Tn. Hasan sudah dipulangkan tapi discharge summary harus diketik manual dari nol. Auto-generate dari EMR tidak jalan.",
    moduleSlug: "rawat-inap",
    priority: "medium",
    status: "open",
    source: "web",
    reporterName: REPORTERS[5].name,
    reporterEmail: REPORTERS[5].email,
    daysAgo: 1,
  },
  {
    title: "Salah input dosis obat - permintaan rollback",
    description: "Saya tadi salah input dosis Amlodipine 100mg (seharusnya 10mg) untuk pasien Bu Rahayu. Sudah disubmit. Mohon dibatalkan urgent!",
    moduleSlug: "farmasi",
    priority: "critical",
    status: "resolved",
    source: "whatsapp",
    reporterName: REPORTERS[0].name,
    reporterEmail: REPORTERS[0].email,
    waPhone: REPORTERS[0].phone,
    daysAgo: 1,
    rootCause: "user_error",
    resolutionNote: "Resep langsung di-void di sistem. Verifikasi via apoteker bahwa belum di-dispensing. Re-entry dengan dosis benar. Tambahkan double-check rule untuk obat antihipertensi.",
    replies: [
      { from: "ai_bot", content: "Resep sudah saya tahan otomatis (status: HOLD) karena dosis Amlodipine 100mg melebihi max dose (10mg) di drug master. Sedang notify apoteker on-duty." },
      { from: "agent", content: "Bagus, AI guardrail bekerja. Resep di-void. Silakan re-entry dengan dosis benar." },
      { from: "user", content: "Alhamdulillah ketahan, terima kasih banyak!" },
    ],
  },
];

async function seedTickets() {
  console.log("🌱 Seeding dummy tickets...\n");

  const allModules = await db.select().from(modules);
  if (allModules.length === 0) {
    console.error("❌ No modules found. Run `bun run db:seed` first.");
    process.exit(1);
  }
  const moduleBySlug = new Map(allModules.map((m) => [m.slug, m]));

  const admin = await db.select().from(users).where(eq(users.email, "admin@salamdesk.com")).limit(1);
  const agent = await db.select().from(users).where(eq(users.email, "operator@salamdesk.com")).limit(1);
  const assignee = agent[0] ?? admin[0];

  if (!admin[0]) {
    console.error("❌ Admin user not found. Run `bun run db:seed` first.");
    process.exit(1);
  }

  // Ensure requesters exist as external helpdesk contacts
  const requesterIdByEmail = new Map<string, string>();
  for (const r of REPORTERS) {
    const requesterId = await findOrCreateRequesterByIdentity("email", r.email, {
      displayName: r.name,
      fullName: r.name,
      email: r.email,
      phone: r.phone,
    });
    requesterIdByEmail.set(r.email, requesterId);
  }
  console.log(`👤 Ensured ${REPORTERS.length} reporter user(s)`);

  let created = 0;
  for (const t of TICKETS) {
    const mod = moduleBySlug.get(t.moduleSlug);
    if (!mod) continue;
    const requesterId = requesterIdByEmail.get(t.reporterEmail)!;

    const createdAt = new Date(Date.now() - t.daysAgo * 24 * 60 * 60 * 1000);
    const ticketId = `TKT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    // SLA deadline from config (resolutionTime)
    let slaDeadlineAt: Date | null = null;
    const cfg = await db.query.slaConfigs.findFirst({
      where: and(eq(slaConfigs.moduleId, mod.id), eq(slaConfigs.priority, t.priority), eq(slaConfigs.isActive, true)),
    });
    if (cfg) {
      slaDeadlineAt = new Date(createdAt.getTime() + cfg.resolutionTimeMinutes * 60 * 1000);
    }

    const resolved = t.status === "resolved" || t.status === "closed";
    const resolvedAt = resolved ? new Date(createdAt.getTime() + Math.max(1, t.daysAgo - 0.2) * 24 * 60 * 60 * 1000) : null;

    await db.insert(tickets).values({
      id: ticketId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      slaStatus: t.slaState ?? (resolved ? "safe" : "safe"),
      slaDeadlineAt,
      moduleId: mod.id,
      requesterId,
      waPhone: t.waPhone ?? null,
      source: t.source,
      assigneeId: t.status === "open" ? null : assignee?.id ?? null,
      resolvedByType: resolved ? "user" : null,
      resolvedById: resolved ? assignee?.id ?? null : null,
      rootCause: t.rootCause ?? null,
      resolutionNote: t.resolutionNote ?? null,
      moduleSetBy: "ai",
      moduleConfidence: "0.92" as unknown as string,
      createdAt,
      updatedAt: resolvedAt ?? createdAt,
      resolvedAt,
    });

    // Initial message (description from user)
    await db.insert(ticketMessages).values({
      ticketId,
      senderId: null,
      requesterId,
      senderType: "requester",
      content: t.description,
      isInternalNote: false,
      source: t.source,
      createdAt,
    });

    // Replies
    let stepMin = 5;
    for (const r of t.replies ?? []) {
      const at = new Date(createdAt.getTime() + stepMin * 60 * 1000);
      stepMin += 7;
      await db.insert(ticketMessages).values({
        ticketId,
        senderId:
          r.from === "user" || r.from === "system" || r.from === "ai_bot" ? null : assignee?.id ?? admin[0].id,
        requesterId: r.from === "user" ? requesterId : null,
        senderType: r.from === "user" ? "requester" : r.from === "ai_bot" ? "ai_agent" : r.from === "system" ? "system" : "staff",
        content: r.content,
        isInternalNote: r.internal ?? false,
        source: t.source,
        createdAt: at,
      });
    }

    if (t.escalated) {
      await db.insert(ticketEscalations).values({
        ticketId,
        escalatedFromId: assignee?.id ?? null,
        escalatedToId: admin[0].id,
        reason: "Critical SLA risk / requires engineer attention",
        escalatedAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
      });
    }

    created++;
  }

  console.log(`✅ Created ${created} tickets with messages\n`);
  console.log("🎉 Done.");
}

seedTickets()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
