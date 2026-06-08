import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { KNOWLEDGE_INGESTION_JOBS, knowledgeIngestionQueue } from "@/lib/queue";
import { createUploadedKnowledgeDocument } from "@/services/knowledge.service";

const f = createUploadthing();

const uploadInputSchema = z.object({
  title: z.string().min(1),
  moduleId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const uploadRouter = {
  knowledgeDocumentUploader: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 1 },
    blob: { maxFileSize: "32MB", maxFileCount: 1 },
  })
    .input(uploadInputSchema)
    .middleware(async ({ req, input }) => {
      const session = await auth.api.getSession({ headers: req.headers });

      if (!session) {
        throw new UploadThingError("Unauthorized");
      }

      return {
        userId: session.user.id,
        title: input.title,
        moduleId: input.moduleId ?? null,
        tags: input.tags ?? [],
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const documentId = crypto.randomUUID();
      const mimeType = file.type ?? "application/octet-stream";

      await createUploadedKnowledgeDocument({
        id: documentId,
        title: metadata.title,
        moduleId: metadata.moduleId,
        tags: metadata.tags,
        createdById: metadata.userId,
        originalFileName: file.name,
        mimeType,
        fileSize: file.size,
        storageKey: file.key,
        fileUrl: file.ufsUrl,
        checksum: file.fileHash,
      });

      await knowledgeIngestionQueue.add(KNOWLEDGE_INGESTION_JOBS.ingestDocument, {
        documentId,
        fileUrl: file.ufsUrl,
        fileName: file.name,
        mimeType,
      });

      return { documentId };
    }),

  // Ticket reply attachments. Unlike the knowledge uploader, this does NOT
  // persist anything on its own — the uploaded file refs are returned to the
  // client and saved against a ticket message when the reply is sent. This
  // avoids orphaned rows when a staff member uploads but never sends.
  ticketAttachmentUploader: f({
    image: { maxFileSize: "8MB", maxFileCount: 5 },
    pdf: { maxFileSize: "16MB", maxFileCount: 3 },
    text: { maxFileSize: "8MB", maxFileCount: 3 },
    blob: { maxFileSize: "16MB", maxFileCount: 3 },
  })
    .middleware(async ({ req }) => {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        throw new UploadThingError("Unauthorized");
      }
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ file }) => {
      return {
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type ?? "application/octet-stream",
      };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
