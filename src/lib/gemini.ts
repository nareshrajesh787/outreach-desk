const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const DRAFT_MODEL = process.env.GEMINI_DRAFT_MODEL || MODEL;
type Chunk = { web?: { uri?: string; title?: string } };
export async function gemini(prompt: string, opts: { search?: boolean; json?: boolean; draft?: boolean } = {}): Promise<{ text: string; sources: string[]; domains: string[] }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const body: Record<string, unknown> = { contents: [{ parts: [{ text: prompt }] }] };
  if (opts.search) body.tools = [{ google_search: {} }];
  else if (opts.json) body.generationConfig = { responseMimeType: "application/json" };
  let model = opts.draft ? DRAFT_MODEL : MODEL;
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body),
    });
    if (r.ok) {
      const j = await r.json();
      const c = j.candidates?.[0];
      const text = (c?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      const chunks: Chunk[] = c?.groundingMetadata?.groundingChunks ?? [];
      return {
        text,
        sources: chunks.map((g) => g.web?.uri).filter(Boolean) as string[],
        domains: chunks.map((g) => g.web?.title).filter(Boolean) as string[],
      };
    }
    last = `Gemini ${r.status} (${model}): ${(await r.text()).slice(0, 300)}`;
    // If the stronger drafting model is unavailable, fall back to the main model.
    if ((r.status === 404 || r.status === 400) && model !== MODEL) { model = MODEL; continue; }
    if (![429, 500, 503].includes(r.status)) break;
    await new Promise((res) => setTimeout(res, 4000 * attempt));
  }
  throw new Error(last);
}
export function parseJson<T>(t: string): T {
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (m ? m[1] : t).trim();
  const s = raw.search(/[\[{]/);
  if (s < 0) throw new Error("no JSON in reply");
  const close = raw[s] === "[" ? "]" : "}";
  const e = raw.lastIndexOf(close);
  return JSON.parse(raw.slice(s, e + 1)) as T;
}
