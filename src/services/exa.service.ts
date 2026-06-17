export type ExaResult = { title: string; url: string; text: string };

export async function exaSearch(query: string, numResults = 5): Promise<ExaResult[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error("EXA_API_KEY is not set.");
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ query, numResults, contents: { text: { maxCharacters: 1000 } } }),
  });
  if (!res.ok) throw new Error(`Exa search failed: ${res.status}`);
  const data = (await res.json()) as {
    results?: { title?: string; url?: string; text?: string }[];
  };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    text: r.text ?? "",
  }));
}
