export type KnowledgeChunkInput = {
  content: string;
  pageNumber?: number | null;
  heading?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type KnowledgeChunk = {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  pageNumber?: number | null;
  heading?: string | null;
  metadata?: Record<string, unknown> | null;
};

const CHUNK_SIZE = 2400;
const CHUNK_OVERLAP = 250;

export function estimateTokenCount(text: string) {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);
}

function splitText(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const maxEnd = Math.min(start + CHUNK_SIZE, normalized.length);
    let end = maxEnd;

    if (maxEnd < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", maxEnd);
      const sentenceBreak = normalized.lastIndexOf(". ", maxEnd);
      const softBreak = Math.max(paragraphBreak, sentenceBreak);

      if (softBreak > start + CHUNK_SIZE / 2) {
        end = softBreak + (softBreak === sentenceBreak ? 1 : 0);
      }
    }

    chunks.push(normalized.slice(start, end).trim());

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks.filter(Boolean);
}

export function chunkKnowledgeContent(input: string | KnowledgeChunkInput[]) {
  const sources =
    typeof input === "string"
      ? [{ content: input }]
      : input.filter((source) => source.content.trim().length > 0);

  let chunkIndex = 0;
  const chunks: KnowledgeChunk[] = [];

  for (const source of sources) {
    for (const chunk of splitText(source.content)) {
      chunks.push({
        content: chunk,
        chunkIndex,
        tokenCount: estimateTokenCount(chunk),
        pageNumber: source.pageNumber ?? null,
        heading: source.heading ?? null,
        metadata: source.metadata ?? null,
      });
      chunkIndex += 1;
    }
  }

  return chunks;
}
