/**
 * Bean research via LLM + web.
 * The LLM classifies the bean and returns structured data.
 * The grind engine owns all numbers — the LLM never invents a grind setting.
 *
 * Transport (see also DEPLOY.md / manifest permissions):
 *   1. Preferred — the platform's host-managed HTTP credential. On desktop
 *      surfaces, `sdk.http.request({ credentialRef })` sends the call and the
 *      HOST injects the OpenAI key server-side. The key never enters this
 *      bundle. This is the correct architecture for a client-side mini app.
 *   2. Fallback — a runtime user key from the Settings screen (localStorage),
 *      used via browser fetch when the host HTTP capability isn't available
 *      (e.g. mobile/portable targets).
 *
 * Graceful degrade: if neither transport can complete, callers fall back to a
 * roast-level-only starting recipe (researchBean) or re-prompt (classify).
 */

import { sdk } from '@theaiplatform/miniapp-sdk';
import type { BeanResearchResult, RoastLevel } from './types';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const LOCAL_KEY = 'dialed:openai-key';

export interface ResearchRequest {
  roaster: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

let cachedCredentialRef: string | null | undefined;

/**
 * Discover a host-managed OpenAI bearer credential, if one is registered in
 * The AI Platform. Returns the opaque credentialRef (never the secret).
 */
async function getCredentialRef(): Promise<string | null> {
  if (cachedCredentialRef !== undefined) return cachedCredentialRef;
  try {
    if (sdk?.credentials?.listHttp) {
      const creds = await sdk.credentials.listHttp();
      const match = creds.find(
        (c) => c.credentialType === 'http_bearer' && /openai/i.test(c.displayName),
      );
      cachedCredentialRef = match?.id ?? null;
    } else {
      cachedCredentialRef = null;
    }
  } catch {
    cachedCredentialRef = null;
  }
  return cachedCredentialRef;
}

/**
 * POST a Chat Completions body and return the parsed JSON response, or null on
 * any failure. Prefers the host credential; falls back to the runtime key.
 */
async function chatCompletion(body: unknown): Promise<unknown | null> {
  const payload = JSON.stringify(body);

  // 1. Host-managed credential — key stays in the platform vault.
  const ref = await getCredentialRef();
  if (sdk?.http?.request && ref) {
    try {
      const resp = await sdk.http.request(
        {
          method: 'POST',
          url: OPENAI_URL,
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          body: payload,
          timeoutMs: 15000,
        },
        { credentialRef: ref },
      );
      if (resp.status < 200 || resp.status >= 300 || !resp.bodyText) {
        console.warn('[Dialed] Host research call failed:', resp.status);
        return null;
      }
      return JSON.parse(resp.bodyText) as unknown;
    } catch (err) {
      console.warn('[Dialed] Host research call error:', err);
      return null;
    }
  }

  // 2. Fallback — runtime user key via browser fetch (portable targets).
  const key = getLocalKey();
  if (!key) return null;
  try {
    const resp = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: payload,
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      console.warn('[Dialed] Research API error:', resp.status);
      return null;
    }
    return (await resp.json()) as unknown;
  } catch (err) {
    console.warn('[Dialed] Research fetch error:', err);
    return null;
  }
}

function firstChoiceContent(data: unknown): string | null {
  const choices = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices;
  return choices?.[0]?.message?.content ?? null;
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

// Fallback when the LLM call can't complete.
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

  const data = await chatCompletion({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const content = firstChoiceContent(data);
  if (!content) return fallbackResearch(fallbackRoast);

  try {
    const parsed = JSON.parse(content) as Partial<BeanResearchResult>;
    return {
      roast: (['light', 'medium', 'dark'].includes(parsed.roast ?? '')
        ? parsed.roast
        : fallbackRoast) as RoastLevel,
      origin: parsed.origin ?? 'Unknown',
      process: parsed.process ?? 'washed',
      tastingNotes: Array.isArray(parsed.tastingNotes) ? parsed.tastingNotes : [],
      // The model can't browse, so we never trust it for URLs — the UI offers a
      // real web-search link instead of fabricated "sources".
      sourceCitations: [],
      description: parsed.description ?? '',
    };
  } catch {
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

  const data = await chatCompletion({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 10,
  });

  const word = firstChoiceContent(data)?.trim().toLowerCase();
  const valid = ['sour', 'bitter', 'weak', 'strong', 'just-right'] as const;
  return valid.includes(word as (typeof valid)[number])
    ? (word as (typeof valid)[number])
    : null;
}

// ---------------------------------------------------------------------------
// Runtime key (fallback transport) — used by the Settings screen
// ---------------------------------------------------------------------------

function getLocalKey(): string {
  try {
    return localStorage.getItem(LOCAL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string): void {
  localStorage.setItem(LOCAL_KEY, key);
}

/** True if a runtime key is stored. (The host-credential path is separate.) */
export function hasLocalKey(): boolean {
  return Boolean(getLocalKey());
}

/**
 * Whether research can run at all: either a host-managed credential is
 * available (preferred) or a runtime key is stored (fallback).
 */
export async function canResearch(): Promise<boolean> {
  if (sdk?.http?.request && (await getCredentialRef())) return true;
  return hasLocalKey();
}
