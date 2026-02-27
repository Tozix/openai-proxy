#!/usr/bin/env npx tsx
/**
 * Ручные тесты прокси: OpenAI, grsai, KIE.
 *
 * Запуск: npm run test
 * Или: npx tsx scripts/test-proxy.ts
 *
 * .env или окружение:
 *   PROXY_BASE_URL (по умолчанию https://proxy.agent-lia.ru)
 *   PROXY_AUTH_PREFIX (по умолчанию myFeedproxy3128)
 *   OPENAI_API_KEY
 *   GRSAI_API_KEY
 *   KIE_API_KEY
 */
import { config } from "dotenv";
import path from "path";

// Явно грузим .env из корня проекта (cwd при npm run test = корень)
const envPath = path.resolve(process.cwd(), ".env");
config({ path: envPath });

const PROXY_BASE = (process.env.PROXY_BASE_URL || "https://proxy.agent-lia.ru").replace(/\/$/, "");
const PROXY_PREFIX = process.env.PROXY_AUTH_PREFIX || "myFeedproxy3128";
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GRSAI_KEY = process.env.GRSAI_API_KEY;
const KIE_KEY = process.env.KIE_API_KEY;

if (process.env.DEBUG_ENV) {
  console.log("[DEBUG] .env loaded from:", envPath);
  console.log("[DEBUG] OPENAI_API_KEY:", OPENAI_KEY ? `${OPENAI_KEY.slice(0, 10)}...` : "(not set)");
  console.log("[DEBUG] GRSAI_API_KEY:", GRSAI_KEY ? "set" : "(not set)");
  console.log("[DEBUG] KIE_API_KEY:", KIE_KEY ? "set" : "(not set)");
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 4
): Promise<Response> {
  for (let i = 1; i <= maxRetries + 1; i++) {
    const resp = await fetch(url, options);
    if (resp.ok) return resp;
    if (resp.status >= 500 && i <= maxRetries) {
      console.log(`HTTP ${resp.status}, retry ${i}/${maxRetries} in ${i * 3}s...`);
      await new Promise((r) => setTimeout(r, i * 3000));
      continue;
    }
    return resp;
  }
  throw new Error("Unreachable");
}

// --- OpenAI: /v1/models ---
async function testOpenaiModels() {
  if (!OPENAI_KEY) {
    console.log("SKIP OpenAI models (no OPENAI_API_KEY)");
    return;
  }
  console.log("\n--- OpenAI: GET /v1/models ---");
  const resp = await fetchWithRetry(
    `${PROXY_BASE}/v1/models`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${PROXY_PREFIX}:${OPENAI_KEY}` },
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!resp.ok) {
    if (resp.status === 403) {
      console.log("SKIP (OpenAI 403: ключ невалиден или нет доступа)");
      return;
    }
    throw new Error(`OpenAI models: HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { data?: Array<{ id: string }> };
  const ids = (data.data ?? []).slice(0, 3).map((m) => m.id);
  console.log("OK:", ids);
}

// --- OpenAI: chat completions ---
async function testOpenaiChat() {
  if (!OPENAI_KEY) {
    console.log("SKIP OpenAI chat (no OPENAI_API_KEY)");
    return;
  }
  console.log("\n--- OpenAI: POST /v1/chat/completions ---");
  const resp = await fetchWithRetry(
    `${PROXY_BASE}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_PREFIX}:${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say 'proxy works' in one sentence." }],
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );
  if (!resp.ok) {
    if (resp.status === 403) {
      console.log("SKIP (OpenAI 403: ключ невалиден или нет доступа)");
      return;
    }
    throw new Error(`OpenAI chat: HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? "";
  console.log("OK:", text.slice(0, 100) + (text.length > 100 ? "..." : ""));
}

// --- OpenAI: chat completions stream ---
async function testOpenaiChatStream() {
  if (!OPENAI_KEY) {
    console.log("SKIP OpenAI chat stream (no OPENAI_API_KEY)");
    return;
  }
  console.log("\n--- OpenAI: POST /v1/chat/completions (stream) ---");
  const resp = await fetchWithRetry(
    `${PROXY_BASE}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_PREFIX}:${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say exactly: ok" }],
        max_tokens: 10,
        stream: true,
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );
  if (!resp.ok) {
    if (resp.status === 403) {
      console.log("SKIP (OpenAI 403: ключ невалиден или нет доступа)");
      return;
    }
    throw new Error(`OpenAI chat stream: HTTP ${resp.status}`);
  }
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const chunks: string[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const p = line.slice(6).trim();
        if (p === "[DONE]") continue;
        try {
          const j = JSON.parse(p) as { choices?: Array<{ delta?: { content?: string } }> };
          chunks.push(j.choices?.[0]?.delta?.content ?? "");
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  const text = chunks.join("");
  console.log(`OK (chunks=${chunks.length}): ${text.slice(0, 50)}`);
}

function extractKieText(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw
      .filter((p: { type?: string }) => p.type === "text")
      .map((p: { text?: string }) => p.text || "")
      .join("");
  }
  return String(raw ?? "");
}

// --- grsai: маленький запрос ---
async function testGrsaiSmall() {
  if (!GRSAI_KEY) {
    console.log("SKIP grsai small (no GRSAI_API_KEY)");
    return;
  }
  console.log("\n--- grsai: маленький запрос ---");
  const resp = await fetchWithRetry(
    `${PROXY_BASE}/grsai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_PREFIX}:${GRSAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-3.1-pro",
        stream: false,
        messages: [
          { role: "system", content: "Ответь кратко по-русски." },
          { role: "user", content: "Привет, одно предложение о маркетинге." },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!resp.ok) {
    throw new Error(`grsai small: HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? "";
  console.log("OK:", text.slice(0, 120) + (text.length > 120 ? "..." : ""));
}

// --- grsai: стриминг ---
async function testGrsaiStream() {
  if (!GRSAI_KEY) {
    console.log("SKIP grsai stream (no GRSAI_API_KEY)");
    return;
  }
  console.log("\n--- grsai: стриминг (стратегия) ---");
  const resp = await fetchWithRetry(
    `${PROXY_BASE}/grsai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_PREFIX}:${GRSAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-3.1-pro",
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "Напиши стратегию кросс-маркетинга от 8000 до 14000 символов на русском.",
          },
          {
            role: "user",
            content:
              "Компания: 3 кофейни в Москве. Механика: сертификаты на скидку.",
          },
        ],
      }),
      signal: AbortSignal.timeout(600_000),
    }
  );

  if (!resp.ok) {
    throw new Error(`grsai stream: HTTP ${resp.status}`);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const p = line.slice(6).trim();
        if (p === "[DONE]") continue;
        try {
          const j = JSON.parse(p) as { choices?: Array<{ delta?: { content?: string } }> };
          chunks.push(j.choices?.[0]?.delta?.content ?? "");
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const result = chunks.join("");
  console.log(`OK: результат ${result.length} символов`);
}

// --- KIE: маленький запрос ---
async function testKieSmall() {
  if (!KIE_KEY) {
    console.log("SKIP KIE small (no KIE_API_KEY)");
    return;
  }
  console.log("\n--- KIE: маленький запрос ---");
  const resp = await fetchWithRetry(
    `${PROXY_BASE}/kie/gemini-3-pro/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_PREFIX}:${KIE_KEY}`,
      },
      body: JSON.stringify({
        stream: false,
        messages: [
          {
            role: "developer",
            content: [{ type: "text", text: "Ответь кратко по-русски." }],
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Привет, одно предложение о маркетинге.",
              },
            ],
          },
        ],
        include_thoughts: true,
        reasoning_effort: "high",
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!resp.ok) {
    throw new Error(`KIE small: HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const raw = data.choices?.[0]?.message?.content;
  const text = extractKieText(raw);
  console.log("OK:", text.slice(0, 120) + (text.length > 120 ? "..." : ""));
}

// --- KIE: стратегия ---
async function testKieStrategy() {
  if (!KIE_KEY) {
    console.log("SKIP KIE strategy (no KIE_API_KEY)");
    return;
  }
  console.log("\n--- KIE: стратегия ---");
  const resp = await fetchWithRetry(
    `${PROXY_BASE}/kie/gemini-3-pro/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_PREFIX}:${KIE_KEY}`,
      },
      body: JSON.stringify({
        stream: false,
        messages: [
          {
            role: "developer",
            content: [
              {
                type: "text",
                text: "Напиши стратегию кросс-маркетинга от 8000 до 14000 символов на русском. Механика: сертификаты на скидку.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Компания: 3 кофейни в Москве. Запрещено: казино, ставки, микрозаймы.",
              },
            ],
          },
        ],
        include_thoughts: true,
        reasoning_effort: "high",
      }),
      signal: AbortSignal.timeout(600_000),
    }
  );

  if (!resp.ok) {
    throw new Error(`KIE strategy: HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const raw = data.choices?.[0]?.message?.content;
  const text = extractKieText(raw);
  console.log(`OK: результат ${text.length} символов`);
}

async function main() {
  console.log(`Proxy: ${PROXY_BASE}`);
  console.log(`Auth: Bearer ${PROXY_PREFIX}:<API_KEY>`);
  if (!OPENAI_KEY && !GRSAI_KEY && !KIE_KEY) {
    console.error("\nУкажите OPENAI_API_KEY, GRSAI_API_KEY и/или KIE_API_KEY в .env или окружении.");
    process.exit(1);
  }

  const tests = [
    testOpenaiModels,
    testOpenaiChat,
    testOpenaiChatStream,
    testGrsaiSmall,
    testGrsaiStream,
    testKieSmall,
    testKieStrategy,
  ];

  for (const fn of tests) {
    try {
      await fn();
    } catch (e) {
      console.error("FAIL:", e);
      process.exit(1);
    }
  }

  console.log("\nВсе тесты пройдены.");
}

main();

/*
  Отличия форматов grsai vs KIE:
  |                | grsai                                    | KIE                                            |
  |----------------|------------------------------------------|------------------------------------------------|
  | URL            | .../grsai/v1/chat/completions             | .../kie/gemini-3-pro/v1/chat/completions       |
  | model          | gemini-3.1-pro / gemini-3-pro             | не указывается (в URL)                         |
  | role system    | role: 'system'                             | role: 'developer'                               |
  | content        | строка                                    | [{ type: 'text', text: '...' }]                 |
  | stream         | true (рекомендуется для длинных ответов)  | false                                          |
  | доп. поля      | —                                         | include_thoughts, reasoning_effort              |
*/
