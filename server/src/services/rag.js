import { env } from '../config/env.js';
import { complete, embed } from './llm.js';
import { retrieve } from './retrieval.js';

export const NOT_FOUND_TEXT = 'This is not covered in the selected documents.';

const SYSTEM = `You are a financial research assistant. Answer ONLY using the numbered sources provided.
Rules:
- After every factual statement, cite the supporting source number like [1] or [2][3].
- Copy figures exactly as written in the sources. Never estimate or round.
- If the sources do not contain the answer, reply with exactly: NOT_FOUND
- Do not use outside knowledge. Do not give investment advice.
- If the question compares companies, organise the answer by company.`;

const label = (doc) => `${doc.company}${doc.fiscalYear ? ` ${doc.fiscalYear}` : ''} ${doc.docType}`.trim();

/** Retrieves context. In compare mode it retrieves per document so one company can't crowd out the other. */
export async function gatherSources({ docs, question, mode, topK = env.topK, minScore = env.minScore }) {
  const [queryEmbedding] = await embed([question]);
  const docById = new Map(docs.map((d) => [d._id.toString(), d]));

  let hits = [];
  if (mode === 'compare') {
    const perDoc = Math.max(2, Math.ceil(topK / docs.length));
    for (const d of docs) hits.push(...(await retrieve({ documentIds: [d._id], queryEmbedding, k: perDoc })));
  } else {
    hits = await retrieve({ documentIds: docs.map((d) => d._id), queryEmbedding, k: topK });
  }

  return hits
    .filter((h) => h.score >= minScore)
    .map((h, i) => {
      const doc = docById.get(h.documentId.toString());
      return {
        n: i + 1,
        documentId: h.documentId,
        title: doc.title,
        label: label(doc),
        page: h.page,
        score: Number(h.score.toFixed(3)),
        text: h.text,
      };
    });
}

export async function answerQuestion({ docs, question, mode = 'ask' }) {
  const sources = await gatherSources({ docs, question, mode });

  // Guardrail 1: nothing relevant retrieved -> don't even call the model.
  if (!sources.length) return { answer: NOT_FOUND_TEXT, grounded: false, citations: [] };

  const context = sources.map((s) => `[${s.n}] (${s.label}, page ${s.page})\n${s.text}`).join('\n\n');
  const raw = await complete({ system: SYSTEM, user: `Question: ${question}\n\nSources:\n${context}` });

  // Mock provider: return an extractive answer so the UI still demonstrates citations.
  const text = raw === null ? `Closest passage found: ${sources[0].text.slice(0, 350)}… [1]` : raw.trim();

  // Guardrail 2: model says the sources don't contain the answer.
  if (text === 'NOT_FOUND') return { answer: NOT_FOUND_TEXT, grounded: false, citations: [] };

  // Return only the sources the answer actually cites.
  const cited = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const used = sources.filter((s) => cited.has(s.n));
  const citations = (used.length ? used : sources).map((s) => ({
    n: s.n, documentId: s.documentId, title: s.title, label: s.label, page: s.page, score: s.score,
    snippet: s.text.slice(0, 450),
  }));

  return { answer: text, grounded: used.length > 0, citations };
}
