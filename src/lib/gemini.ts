const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export async function gemini(prompt: string, opts: { search?: boolean; json?: boolean } = {}): Promise<{ text: string; sources: string[] }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const body: Record<string, unknown> = { contents: [{ parts: [{ text: prompt }] }] };
  if (opts.search) body.tools = [{ google_search: {} }];
  else if (opts.json) body.generationConfig = { responseMimeType: "application/json" };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const c = j.candidates?.[0];
  const text = (c?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  const sources = (c?.groundingMetadata?.groundingChunks ?? []).map((g: { web?: { uri?: string } }) => g.web?.uri).filter(Boolean) as string[];
  return { text, sources };
}
export function parseJson<T>(t: string): T {
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (m ? m[1] : t).trim();
  const s = raw.search(/[\[{]/);
  return JSON.parse(s > 0 ? raw.slice(s) : raw) as T;
}
