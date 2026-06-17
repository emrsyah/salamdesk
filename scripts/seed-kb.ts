/**
 * Seed sample Knowledge Base articles for Phase 5 AI Triage testing.
 *
 * Run with: bun run scripts/seed-kb.ts
 *
 * Creates one article per SIMRS module so the AI has something to match against.
 * In production these will be managed via the Phase 6 KB editor.
 */
import "dotenv/config";
import { db } from "../src/db";
import { knowledgeBase } from "../src/db/schema/knowledge-base";
import { modules } from "../src/db/schema/modules";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

async function getModuleId(slug: string): Promise<string | null> {
  const result = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1)
    .execute();
  return result[0]?.id ?? null;
}

const ARTICLES: {
  slug: string;
  title: string;
  content: string;
  tags: string[];
}[] = [
  {
    slug: "igd",
    title: "Antrian IGD Menumpuk atau Sistem Triage Tidak Responsif",
    content: `Jika antrian IGD menumpuk atau sistem triage tidak menampilkan data terbaru, ikuti langkah berikut:

1. Periksa koneksi jaringan komputer di IGD — pastikan kabel LAN terpasang atau WiFi tersambung.
2. Refresh halaman SIMRS dengan menekan Ctrl+F5 untuk membersihkan cache browser.
3. Jika data pasien tidak muncul, coba logout dan login kembali ke sistem.
4. Pastikan server SIMRS dalam kondisi online — hubungi admin IT jika server down.
5. Untuk antrian yang macet, gunakan mode offline manual (buku register) sementara sistem diperbaiki.
6. Laporkan nomor komputer dan jam kejadian ke tim IT agar dapat dilacak di log server.

Jika masalah berlanjut setelah langkah di atas, eskalasikan ke engineer SIMRS dengan menyertakan screenshot error.`,
    tags: ["antrian", "igd", "triage", "sistem down", "tidak responsif"],
  },
  {
    slug: "farmasi",
    title: "Resep Tidak Muncul di Modul Farmasi",
    content: `Jika resep yang sudah ditulis dokter tidak muncul di modul farmasi, coba langkah berikut:

1. Pastikan dokter sudah menyimpan (submit) resep di SIMRS, bukan hanya mengisi draft.
2. Refresh halaman antrian farmasi dengan Ctrl+F5 atau tombol refresh di SIMRS.
3. Cek filter tanggal — pastikan filter menampilkan tanggal hari ini.
4. Periksa apakah pasien sudah terdaftar di kunjungan hari ini (registrasi harus selesai dulu).
5. Jika resep masih tidak muncul setelah 5 menit, minta dokter untuk membuka kembali catatan pasien dan simpan ulang resep.
6. Pastikan modul farmasi dan modul dokter terhubung ke server yang sama (terkadang ada cache routing).

Untuk kasus darurat, apotek dapat menerima resep manual (kertas) sementara masalah diselesaikan.`,
    tags: ["resep", "farmasi", "tidak muncul", "obat", "apotek"],
  },
  {
    slug: "billing",
    title: "Error Saat Cetak Kwitansi atau Tagihan Pembayaran",
    content: `Jika terjadi error saat mencetak kwitansi atau tagihan, ikuti panduan ini:

1. Pastikan printer dalam kondisi online dan kertas tersedia.
2. Coba cetak ulang dari menu Riwayat Pembayaran — pilih transaksi dan klik Cetak Ulang.
3. Jika muncul pesan "Printer not found", periksa koneksi USB/network printer dan restart print spooler di Windows.
4. Untuk error "Data tidak lengkap", pastikan semua layanan sudah diinput dan billing sudah di-finalize oleh petugas.
5. Jika kwitansi sudah tercetak tapi angkanya salah, JANGAN cetak ulang — hubungi kepala kasir untuk koreksi.
6. Untuk masalah PDF tidak terbuka, update Adobe Reader atau gunakan browser Chrome untuk preview.

Catatan: Kwitansi yang sudah dicetak tidak bisa diedit langsung — butuh proses koreksi melalui supervisor billing.`,
    tags: ["kwitansi", "billing", "cetak", "tagihan", "pembayaran", "error cetak"],
  },
  {
    slug: "rawat-inap",
    title: "Data Pasien Rawat Inap Tidak Tersinkronisasi",
    content: `Jika data pasien rawat inap tidak tersinkronisasi antar modul atau kamar tidak ter-update, coba:

1. Refresh modul rawat inap dengan Ctrl+F5 — data biasanya real-time tapi bisa tertunda 30 detik.
2. Periksa apakah pasien sudah terdaftar dengan benar di admisi dan ada nomor rekam medis.
3. Untuk perpindahan kamar yang tidak terupdate, pastikan petugas admisi mengkonfirmasi di SIMRS (bukan hanya fisik).
4. Cek status bed di floor map — jika kamar masih berstatus "diisi" padahal kosong, lakukan sync manual dari menu Admin → Sync Kamar.
5. Jika pasien tidak muncul di daftar rawat inap padahal sudah masuk, minta admisi untuk verifikasi kunjungan.

Untuk masalah kritis (pasien tidak bisa discharge karena sistem), hubungi tim IT segera.`,
    tags: ["rawat inap", "kamar", "sinkronisasi", "bed", "admisi", "pasien"],
  },
  {
    slug: "rawat-jalan",
    title: "Antrian Poli Rawat Jalan Tidak Bisa Dipanggil",
    content: `Jika sistem panggilan antrian poli tidak berfungsi, ikuti langkah berikut:

1. Periksa layar antrian — pastikan layar display antrian menyala dan terhubung ke server.
2. Refresh modul antrian rawat jalan dan cek apakah nomor antrian sudah terdaftar hari ini.
3. Jika sistem panggilan suara tidak bunyi, periksa volume speaker dan koneksi ke server audio.
4. Pastikan dokter sudah login ke SIMRS di komputer poli — panggilan antrian dikendalikan dari sana.
5. Untuk antrian yang "stuck" (tidak bisa dipanggil meskipun ada pasien), coba reset antrian dari menu Admin → Reset Antrian Hari Ini (perlu konfirmasi kepala poli).
6. Jika pasien sudah terlanjur lama menunggu, utamakan penanganan manual dengan memanggil nama langsung.`,
    tags: ["rawat jalan", "antrian", "poli", "panggilan", "display antrian"],
  },
  {
    slug: "radiologi",
    title: "Hasil Foto/Radiologi Tidak Muncul di SIMRS",
    content: `Jika hasil pemeriksaan radiologi tidak muncul di SIMRS setelah pemeriksaan selesai:

1. Pastikan teknisi radiologi sudah menyimpan dan mengupload hasil di sistem PACS/RIS.
2. Tunggu 5–10 menit — sinkronisasi antara PACS dan SIMRS membutuhkan waktu.
3. Refresh halaman hasil radiologi di SIMRS dengan Ctrl+F5.
4. Periksa apakah nomor permintaan pemeriksaan (requisition number) sudah benar — minta konfirmasi ke radiologi.
5. Jika dokter membutuhkan hasil segera, radiologi bisa memberikan printout sementara hasil SIMRS diproses.
6. Untuk file DICOM yang tidak bisa dibuka, pastikan viewer DICOM (Osirix/RadiAnt) terinstall di komputer dokter.

Laporkan ke tim IT jika integrasi PACS-SIMRS bermasalah secara konsisten.`,
    tags: ["radiologi", "foto", "hasil", "PACS", "DICOM", "rontgen", "USG"],
  },
  {
    slug: "laboratorium",
    title: "Hasil Lab Terlambat Muncul atau Tidak Terkirim ke Dokter",
    content: `Jika hasil pemeriksaan laboratorium terlambat atau tidak muncul di layar dokter:

1. Cek status pemeriksaan di modul lab — apakah sudah "Selesai" atau masih "Proses".
2. Pastikan analis sudah memverifikasi dan mengvalidasi hasil di SIMRS laboratorium.
3. Refresh modul di sisi dokter — hasil tersinkron otomatis setelah divalidasi.
4. Untuk hasil kritis (nilai panic), lab harus menghubungi dokter secara langsung via telepon, tidak menunggu SIMRS.
5. Jika hasil sudah divalidasi tapi tidak muncul di SIMRS dokter, minta analis untuk lakukan "Kirim Ulang" dari menu lab.
6. Periksa apakah nomor kunjungan pasien sudah benar di formulir permintaan lab.

Catatan: Hasil lab tidak bisa diedit setelah divalidasi. Jika ada kesalahan, butuh proses koreksi resmi.`,
    tags: ["laboratorium", "hasil lab", "analisis", "validasi", "dokter", "pengiriman hasil"],
  },
  {
    slug: "rekam-medis",
    title: "Rekam Medis Pasien Tidak Ditemukan atau Duplikat",
    content: `Jika rekam medis pasien tidak ditemukan atau ditemukan data duplikat:

1. Coba cari dengan variasi nama — perhatikan ejaan berbeda (mis. "Siti" vs "Sity") atau nama yang terbalik.
2. Cari berdasarkan nomor rekam medis (RM) jika tersedia, bukan hanya nama.
3. Untuk pasien baru yang tidak ditemukan, cek apakah sudah terdaftar di sistem — mungkin belum di-registrasi.
4. Jika ditemukan data duplikat (dua nomor RM untuk satu pasien), JANGAN gabungkan manual — laporkan ke petugas rekam medis untuk proses merge resmi.
5. Untuk rekam medis yang terkunci atau tidak bisa diakses, periksa hak akses pengguna Anda — beberapa RM dibatasi aksesnya.
6. Pastikan Anda mencari di database yang benar (rawat jalan vs rawat inap vs IGD bisa berbeda tampilan).

Proses penggabungan duplikat RM harus melalui kepala rekam medis dan tim IT untuk menjaga integritas data.`,
    tags: ["rekam medis", "RM", "duplikat", "tidak ditemukan", "pencarian pasien", "merge"],
  },
];

async function seedKb() {
  console.log("🌱 Seeding knowledge base articles...\n");

  let created = 0;
  let skipped = 0;

  for (const article of ARTICLES) {
    const moduleId = await getModuleId(article.slug);

    if (!moduleId) {
      console.warn(`⚠  Module with slug "${article.slug}" not found — skipping article "${article.title}"`);
      skipped++;
      continue;
    }

    // Check if article already exists (by title to avoid duplicates on re-run)
    const existing = await db
      .select({ id: knowledgeBase.id })
      .from(knowledgeBase)
      .where(eq(knowledgeBase.title, article.title))
      .limit(1)
      .execute();

    if (existing.length > 0) {
      console.log(`⏩ Already exists: "${article.title}"`);
      skipped++;
      continue;
    }

    await db.insert(knowledgeBase).values({
      id: crypto.randomUUID(),
      title: article.title,
      content: article.content,
      moduleIds: [moduleId],
      tags: article.tags,
      createdById: null,
    });

    console.log(`✅ Created: "${article.title}" [${article.slug}]`);
    created++;
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
  process.exit(0);
}

seedKb().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
