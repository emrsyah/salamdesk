import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { tickets, ticketMessages } from "@/db/schema/tickets";
import { aiSuggestions } from "@/db/schema/knowledge-base";
import { eq } from "drizzle-orm";
import { getAiModel, AI_CONFIDENCE_THRESHOLD } from "@/lib/ai";
import { getAllModules } from "@/services/module.service";
import { searchKnowledgeBase } from "@/services/knowledge.service";
import { sendWhatsAppMessage } from "@/services/whatsapp.service";

export type TriageResult = {
  ticketId: string;
  moduleId: string | null;
  moduleName: string | null;
  moduleConfidence: number;
  priority: "low" | "medium" | "critical";
  kbArticleId: string | null;
  kbArticleTitle: string | null;
  replyConfidence: number;
  autoReplied: boolean;
  suggestedReply: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Schema definitions for structured AI outputs
// ─────────────────────────────────────────────────────────────────────────────

const ModuleClassificationSchema = z.object({
  moduleId: z.string().nullable().describe("The UUID of the best matching module, or null if none fits"),
  moduleName: z.string().nullable().describe("The name of the best matching module"),
  confidence: z.number().min(0).max(1).describe("Confidence score from 0.0 to 1.0"),
  reasoning: z.string().describe("Brief explanation of why this module was chosen"),
});

const PriorityClassificationSchema = z.object({
  priority: z.enum(["low", "medium", "critical"]).describe("Ticket urgency level"),
  reasoning: z.string().describe("Brief explanation of urgency assessment"),
});

const KbRelevanceSchema = z.object({
  isRelevant: z.boolean().describe("Whether the KB article actually answers the ticket's question"),
  confidence: z.number().min(0).max(1).describe("How confident the AI is that this article helps (0.0–1.0)"),
  suggestedReply: z.string().nullable().describe("A helpful reply to send to the reporter (in Indonesian), or null if article is not relevant enough"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Classify which SIMRS module the ticket belongs to
// ─────────────────────────────────────────────────────────────────────────────

async function classifyModule(
  title: string,
  description: string | null,
  modules: { id: string; name: string; slug: string }[]
) {
  const moduleList = modules
    .map((m) => `- ID: ${m.id} | Nama: ${m.name} | Slug: ${m.slug}`)
    .join("\n");

  const { object } = await generateObject({
    model: getAiModel(),
    schema: ModuleClassificationSchema,
    prompt: `Kamu adalah asisten klasifikasi tiket SIMRS (Sistem Informasi Manajemen Rumah Sakit) untuk RSUD Karawang.

Modul SIMRS yang tersedia:
${moduleList}

Tiket masuk:
Judul: ${title}
Deskripsi: ${description ?? "(tidak ada deskripsi)"}

Tentukan modul SIMRS mana yang paling sesuai dengan tiket ini. 
Jika tidak ada modul yang cocok, kembalikan null untuk moduleId dan moduleName.
Berikan confidence score dari 0.0 (sangat tidak yakin) hingga 1.0 (sangat yakin).`,
  });

  return object;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Classify ticket priority based on urgency signals
// ─────────────────────────────────────────────────────────────────────────────

async function classifyPriority(
  title: string,
  description: string | null,
  currentPriority: string
) {
  const { object } = await generateObject({
    model: getAiModel(),
    schema: PriorityClassificationSchema,
    prompt: `Kamu adalah asisten triase tiket untuk rumah sakit RSUD Karawang.

Tiket masuk:
Judul: ${title}
Deskripsi: ${description ?? "(tidak ada deskripsi)"}
Prioritas saat ini: ${currentPriority}

Tentukan prioritas tiket ini:
- "critical" = mempengaruhi banyak pasien, sistem down, antrian macet, tidak bisa akses sama sekali
- "medium" = ada masalah tapi masih bisa disiasati, atau tidak mendesak
- "low" = pertanyaan, permintaan informasi, atau keluhan minor

Berikan penilaian prioritas dan alasannya dalam Bahasa Indonesia.`,
  });

  return object;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Evaluate whether a KB article answers the ticket
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateKbMatch(
  title: string,
  description: string | null,
  kbTitle: string,
  kbContent: string
) {
  const { object } = await generateObject({
    model: getAiModel(),
    schema: KbRelevanceSchema,
    prompt: `Kamu adalah asisten helpdesk SIMRS di RSUD Karawang.

Tiket dari pengguna:
Judul: ${title}
Deskripsi: ${description ?? "(tidak ada deskripsi)"}

Artikel Knowledge Base yang ditemukan:
Judul: ${kbTitle}
Isi: ${kbContent.slice(0, 1500)}

Apakah artikel KB ini dapat menjawab pertanyaan/masalah pengguna?
Jika ya, buat balasan yang membantu dalam Bahasa Indonesia (maks 3 paragraf) yang merangkum solusi dari artikel KB tersebut.
Jika tidak relevan, kembalikan isRelevant: false dan suggestedReply: null.`,
  });

  return object;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main triage orchestration
// ─────────────────────────────────────────────────────────────────────────────

export async function triageTicket(ticketId: string): Promise<TriageResult> {
  // Fetch the ticket
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      id: true,
      title: true,
      description: true,
      priority: true,
      source: true,
      waPhone: true,
      moduleId: true,
    },
  });

  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  const result: TriageResult = {
    ticketId,
    moduleId: ticket.moduleId ?? null,
    moduleName: null,
    moduleConfidence: 0,
    priority: ticket.priority,
    kbArticleId: null,
    kbArticleTitle: null,
    replyConfidence: 0,
    autoReplied: false,
    suggestedReply: null,
  };

  try {
    // ── Step 1: Module classification ─────────────────────────────────────────
    const activeModules = await getAllModules({ activeOnly: true });

    let classifiedModuleId = ticket.moduleId;
    let classifiedModuleName: string | null = null;
    let moduleConfidence = 0;

    // Only classify module if not already set (WA tickets have null moduleId)
    if (!ticket.moduleId && activeModules.length > 0) {
      const moduleResult = await classifyModule(
        ticket.title,
        ticket.description,
        activeModules
      );

      classifiedModuleId = moduleResult.moduleId;
      classifiedModuleName = moduleResult.moduleName;
      moduleConfidence = moduleResult.confidence;

      console.log(
        `[AI] Module classification: ${moduleResult.moduleName} (${(moduleConfidence * 100).toFixed(0)}%)`
      );
    } else if (ticket.moduleId) {
      const mod = activeModules.find((m) => m.id === ticket.moduleId);
      classifiedModuleName = mod?.name ?? null;
      moduleConfidence = 1; // User explicitly set it
    }

    result.moduleId = classifiedModuleId;
    result.moduleName = classifiedModuleName;
    result.moduleConfidence = moduleConfidence;

    // ── Step 2: Priority classification ──────────────────────────────────────
    const priorityResult = await classifyPriority(
      ticket.title,
      ticket.description,
      ticket.priority
    );
    result.priority = priorityResult.priority;

    console.log(`[AI] Priority: ${priorityResult.priority} — ${priorityResult.reasoning}`);

    // ── Step 3: KB search ─────────────────────────────────────────────────────
    const searchQuery = `${ticket.title} ${ticket.description ?? ""}`.trim();
    const kbMatches = await searchKnowledgeBase(searchQuery, {
      moduleId: classifiedModuleId ?? undefined,
      limit: 3,
    });

    let replyConfidence = 0;
    let suggestedReply: string | null = null;
    let bestKbId: string | null = null;
    let bestKbTitle: string | null = null;

    if (kbMatches.length > 0) {
      // Try top KB match
      const topMatch = kbMatches[0];
      const kbEval = await evaluateKbMatch(
        ticket.title,
        ticket.description,
        topMatch.title,
        topMatch.content
      );

      if (kbEval.isRelevant) {
        replyConfidence = kbEval.confidence;
        suggestedReply = kbEval.suggestedReply;
        bestKbId = topMatch.id;
        bestKbTitle = topMatch.title;

        console.log(
          `[AI] KB match: "${topMatch.title}" (confidence: ${(replyConfidence * 100).toFixed(0)}%)`
        );
      } else {
        console.log(`[AI] KB article "${topMatch.title}" not relevant enough.`);
      }
    } else {
      console.log("[AI] No KB articles found for this ticket.");
    }

    result.kbArticleId = bestKbId;
    result.kbArticleTitle = bestKbTitle;
    result.replyConfidence = replyConfidence;
    result.suggestedReply = suggestedReply;

    // ── Step 4: Persist triage results to DB ──────────────────────────────────
    await db
      .update(tickets)
      .set({
        moduleId: classifiedModuleId ?? ticket.moduleId,
        moduleConfidence: moduleConfidence.toString(),
        moduleSetBy: ticket.moduleId ? "user" : "ai",
        priority: priorityResult.priority,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId))
      .execute();

    // Insert ai_suggestions row
    await db
      .insert(aiSuggestions)
      .values({
        ticketId,
        suggestedKbId: bestKbId,
        confidenceScore: replyConfidence.toString(),
        wasHelpful: null,
      })
      .execute();

    // ── Step 5: Auto-reply if confidence meets threshold ──────────────────────
    if (suggestedReply && replyConfidence >= AI_CONFIDENCE_THRESHOLD) {
      await db
        .insert(ticketMessages)
        .values({
          ticketId,
          senderId: null,
          senderType: "ai_bot",
          content: suggestedReply,
          isInternalNote: false,
          source: ticket.source,
        })
        .execute();

      // If WA ticket, also deliver via WhatsApp
      if (ticket.source === "whatsapp" && ticket.waPhone) {
        await sendWhatsAppMessage(ticket.waPhone, suggestedReply);
        console.log(`[AI] Auto-reply sent to WhatsApp ${ticket.waPhone}`);
      }

      result.autoReplied = true;
      console.log(`[AI] Auto-reply sent for ticket ${ticketId}`);
    } else {
      console.log(
        `[AI] Confidence ${(replyConfidence * 100).toFixed(0)}% below threshold — no auto-reply.`
      );
    }

    return result;
  } catch (err) {
    console.error(`[AI] Triage failed for ticket ${ticketId}:`, err);
    // Return partial result — don't crash the worker
    return result;
  }
}
