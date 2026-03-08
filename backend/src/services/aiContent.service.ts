/**
 * aiContent.service.ts
 *
 * AI-powered content generation using OpenAI.
 * Falls back gracefully if OPENAI_API_KEY is not set.
 * Rate-limited with batching for large runs.
 */

import { TemplateVars } from './templateEngine.service';

const OAI_URL = 'https://api.openai.com/v1/chat/completions';

export interface AiEnhancement {
  heroHeadline:    string;
  heroSubheadline: string;
  localParagraph:  string;   // unique city-specific paragraph
  faqItems:        Array<{ q: string; a: string }>;
  uniqueAngle:     string;   // 1-sentence differentiator
}

// ─── OpenAI wrapper ───────────────────────────────────────────────

async function chat(
  system: string,
  user: string,
  model = 'gpt-4o-mini',
  maxTokens = 1000
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch(OAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.72,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

function parseJson<T>(raw: string): T {
  const clean = raw.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean) as T;
}

// ─── Main AI enhancement ──────────────────────────────────────────

export async function generateAiEnhancement(
  vars: TemplateVars,
  extraContext?: string
): Promise<AiEnhancement> {
  const system = `You are an expert real estate SEO copywriter for the ${vars.stateCode} market.
Your writing is hyper-local, empathetic to motivated sellers, and never generic.
Always respond with valid JSON only — no markdown, no explanation.`;

  const user = `Write unique SEO content for a real estate landing page.

Target: ${vars.city}, ${vars.stateCode} (ZIP ${vars.zipCode})
Service: ${vars.serviceLabel}
Company: ${vars.company}
Median Home Value: ${vars.medianValue}
Population: ${vars.population}
Near: ${vars.nearbyCity}
${extraContext ? `Context: ${extraContext}` : ''}

Return ONLY this JSON:
{
  "heroHeadline": "8-word max compelling headline mentioning ${vars.city}",
  "heroSubheadline": "20-word max subheadline with urgency and local context",
  "localParagraph": "2-3 sentence paragraph with genuine local insights about ${vars.city} real estate, mentioning ${vars.zipCode}",
  "faqItems": [
    { "q": "question specific to ${vars.city} or ${vars.stateCode}", "a": "2-sentence answer" },
    { "q": "another hyper-local question", "a": "2-sentence answer" },
    { "q": "question about the process in ${vars.stateCode}", "a": "2-sentence answer" }
  ],
  "uniqueAngle": "One sentence describing what makes selling in ${vars.city} unique right now"
}`;

  const raw = await chat(system, user);
  return parseJson<AiEnhancement>(raw);
}

// ─── Batch with rate limiting ─────────────────────────────────────

export async function generateBatch(
  varsList: TemplateVars[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, AiEnhancement>> {
  const results = new Map<string, AiEnhancement>();
  const CONCURRENT = 3;
  const DELAY_MS   = 800;

  for (let i = 0; i < varsList.length; i += CONCURRENT) {
    const batch = varsList.slice(i, i + CONCURRENT);
    const settled = await Promise.allSettled(batch.map(v => generateAiEnhancement(v)));

    settled.forEach((r, idx) => {
      const key = `${batch[idx].zipCode}_${batch[idx].serviceType}`;
      if (r.status === 'fulfilled') results.set(key, r.value);
      else console.warn(`AI failed for ${key}:`, r.reason?.message);
    });

    onProgress?.(Math.min(i + CONCURRENT, varsList.length), varsList.length);

    if (i + CONCURRENT < varsList.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  return results;
}

export const isAiAvailable = (): boolean => !!process.env.OPENAI_API_KEY;
