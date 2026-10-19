import { env } from '../config/env.js';

const normalize = (v) => {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
};

/** Offline stand-in: hashes words into a fixed-size vector. Lexical only, but lets the app run with no keys. */
function mockEmbed(text) {
  const v = new Array(env.embedDims).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) || []) {
    let h = 2166136261;
    for (const c of word) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    v[Math.abs(h) % env.embedDims] += 1;
  }
  return normalize(v);
}

export async function embed(texts) {
  if (env.embedProvider === 'mock') return texts.map(mockEmbed);

  const out = [];
  for (let i = 0; i < texts.length; i += 64) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.openaiKey}` },
      body: JSON.stringify({ model: env.embedModel, input: texts.slice(i, i + 64) }),
    });
    if (!res.ok) throw new Error(`Embedding API ${res.status}: ${await res.text()}`);
    const json = await res.json();
    out.push(...json.data.map((d) => normalize(d.embedding)));
  }
  return out;
}

/** Returns the model's text, or null when CHAT_PROVIDER=mock. */
export async function complete({ system, user, maxTokens = 700 }) {
  if (env.chatProvider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.anthropicModel, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  if (env.chatProvider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.openaiKey}` },
      body: JSON.stringify({
        model: env.openaiChatModel,
        max_tokens: maxTokens,
        temperature: 0,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.choices[0].message.content;
  }
  return null;
}
