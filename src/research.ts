/**
 * Bean research via LLM + web.
 * The LLM classifies the bean and returns structured data.
 * The grind engine owns all numbers — the LLM never invents a grind setting.
 *
 * Graceful degrade: if the network call fails, derive a starting recipe
 * from roast level alone (the user must supply roast).
 */

import type { BeanResearchResult, RoastLevel } from './types';

export interface ResearchRequest {
  roaster: string;
  name: string;
}

// Fallback when network is unavailable or LLM call fails
function fallbackResearch(roast: RoastLevel): BeanResearchResult {
  return {
    roast,
    origin: 'Unknown',
    process: 'washed',
    tastingNotes: [],
    sourceCitations: [],
    description:
      'Could not reach the research service. Starting recipe is based on roast level alone — the taste loop will get you there.',
  };
}

/**
 * Ask the platform LLM to research a bean and return structured classification.
 * Uses the platform's fetch capability (network.fetch permission declared in manifest).
 *
 * In production this would call a TAP-hosted LLM capability port.
 * For the demo we call a simple structured-output endpoint.
 */
export async function researchBean(
  req: ResearchRequest,
  fallbackRoast: RoastLevel = 'medium',
): Promise<BeanResearchResult> {
  const prompt = `You are a specialty coffee expert. Research the following coffee bean and return a JSON object with these exact fields:
- roast: one of "light", "medium", or "dark"
- origin: country or region (string)
- process: one of "washed", "natural", "honey", "anaerobic", "other"
- tastingNotes: array of 3-5 tasting note strings
- description: 2-3 sentence narrative about this bean's character and what makes it interesting

Bean: ${req.roaster} — ${req.name}

Do NOT invent URLs or citations — you cannot browse the web, so any link would be a guess.
If you are unsure of a field, make your best expert estimate from the roaster and name.
Respond ONLY with valid JSON, no markdown fences.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // In a real TAP deployment, the API key would come from a host capability / secret port
        // For demo: the app will use a user-provided key from settings, or fall back gracefully
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn('[Dialed] Research API error:', response.status);
      return fallbackResearch(fallbackRoast);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content;
    if (!content) return fallbackResearch(fallbackRoast);

    const parsed = JSON.parse(content) as Partial<BeanResearchResult>;
    return {
      roast: (['light', 'medium', 'dark'].includes(parsed.roast ?? '') ? parsed.roast : fallbackRoast) as RoastLevel,
      origin: parsed.origin ?? 'Unknown',
      process: parsed.process ?? 'washed',
      tastingNotes: Array.isArray(parsed.tastingNotes) ? parsed.tastingNotes : [],
      // The model can't browse, so we never trust it for URLs — the UI offers a
      // real web-search link instead of fabricated "sources".
      sourceCitations: [],
      description: parsed.description ?? '',
    };
  } catch (err) {
    console.warn('[Dialed] Research failed, using fallback:', err);
    return fallbackResearch(fallbackRoast);
  }
}

/**
 * Classify free-text taste input into a TasteResult bucket.
 * Falls back to null if classification fails (caller should prompt again).
 */
export async function classifyTasteText(
  text: string,
): Promise<'sour' | 'bitter' | 'weak' | 'strong' | 'just-right' | null> {
  const prompt = `Classify this coffee tasting note into exactly one of: sour, bitter, weak, strong, just-right.
Note: "${text}"
Respond with only the single word.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;
    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const word = data.choices[0]?.message?.content?.trim().toLowerCase();
    const valid = ['sour', 'bitter', 'weak', 'strong', 'just-right'] as const;
    return valid.includes(word as typeof valid[number]) ? (word as typeof valid[number]) : null;
  } catch {
    return null;
  }
}

function getApiKey(): string {
  // 1. Build-time env var (from .env via rsbuild — preferred, never committed)
  //    Rsbuild loadEnv exposes OPENAI_API_KEY as process.env.OPENAI_API_KEY
  const envKey = (process.env as Record<string, string | undefined>).OPENAI_API_KEY;
  if (envKey && envKey !== 'undefined') return envKey;
  // 2. Runtime override stored in localStorage (settings screen / DevTools fallback)
  try {
    return localStorage.getItem('dialed:openai-key') ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string): void {
  localStorage.setItem('dialed:openai-key', key);
}

export function hasApiKey(): boolean {
  return Boolean(getApiKey());
}
