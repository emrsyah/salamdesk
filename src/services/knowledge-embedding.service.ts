import { createRequire } from "node:module";
import { startActiveObservation } from "@langfuse/tracing";

const EMBEDDING_DIMENSIONS = 1024;
const EMBEDDING_BATCH_SIZE = 128;

type VoyageEmbedding = {
  embedding?: number[];
};

type VoyageEmbedResponse = {
  data?: VoyageEmbedding[];
};

type VoyageClient = {
  embed(input: {
    input: string[];
    inputType: "document" | "query";
    model: string;
    outputDimension: number;
  }): Promise<VoyageEmbedResponse>;
};

type VoyageClientConstructor = new (options: { apiKey: string }) => VoyageClient;

const require = createRequire(import.meta.url);

let client: VoyageClient | null = null;

function getVoyageClient() {
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is missing from environment variables");
  }

  const { VoyageAIClient } = require("voyageai") as {
    VoyageAIClient: VoyageClientConstructor;
  };

  client ??= new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  return client;
}

function getEmbeddingModel() {
  return process.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-4";
}

async function embedTexts(texts: string[], inputType: "document" | "query") {
  if (texts.length === 0) {
    return [];
  }

  // Voyage uses its own SDK (not the Vercel AI SDK), so trace it manually as a
  // generation. Nests under the active triage/ingestion trace when present.
  return startActiveObservation(
    `voyage-embed-${inputType}`,
    (gen) => {
      gen.update({
        model: getEmbeddingModel(),
        // Record sizes, not raw text, to keep PII/large payloads out of traces.
        input: { count: texts.length, inputType },
      });
      return runEmbed(texts, inputType).then((embeddings) => {
        gen.update({ output: { embeddings: embeddings.length } });
        return embeddings;
      });
    },
    { asType: "generation" },
  );
}

async function runEmbed(texts: string[], inputType: "document" | "query") {
  const embeddings: number[][] = [];
  const voyage = getVoyageClient();

  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    const response = await voyage.embed({
      input: batch,
      inputType,
      model: getEmbeddingModel(),
      outputDimension: EMBEDDING_DIMENSIONS,
    });

    const batchEmbeddings = response.data ?? [];
    if (batchEmbeddings.length !== batch.length) {
      throw new Error("Voyage returned an unexpected number of embeddings");
    }

    for (const item of batchEmbeddings) {
      if (!item.embedding) {
        throw new Error("Voyage returned an empty embedding");
      }
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}

export async function embedKnowledgeChunks(chunks: string[]) {
  return embedTexts(chunks, "document");
}

export async function embedKnowledgeQuery(query: string) {
  const [embedding] = await embedTexts([query], "query");
  return embedding;
}

export function formatPgVector(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
