import { env } from '../config/env.js';
import { embed } from './llm.js';
import { retrieve } from './retrieval.js';

/**
 * Measures retrieval quality (not the LLM's writing).
 * Each case: { question, expectedPhrases: ["text that must appear in a retrieved chunk"] }
 *         or { question, expectNotFound: true }  -> passes when nothing clears MIN_SCORE.
 * Metrics: hit@k (was the right passage in the top k?) and MRR (how high was it ranked?).
 */
export async function runEvaluation({ documentIds, cases, topK = env.topK, minScore = env.minScore }) {
  const results = [];
  for (const c of cases) {
    const [queryEmbedding] = await embed([c.question]);
    const hits = await retrieve({ documentIds, queryEmbedding, k: topK });

    if (c.expectNotFound) {
      const confident = hits.filter((h) => h.score >= minScore);
      results.push({ question: c.question, type: 'refusal', passed: confident.length === 0, topScore: hits[0]?.score ?? 0 });
      continue;
    }

    const phrases = (c.expectedPhrases || []).map((p) => p.toLowerCase());
    const rank = hits.findIndex((h) => phrases.some((p) => h.text.toLowerCase().includes(p)));
    results.push({
      question: c.question,
      type: 'retrieval',
      passed: rank !== -1,
      rank: rank === -1 ? null : rank + 1,
      topScore: hits[0]?.score ?? 0,
    });
  }

  const retrieval = results.filter((r) => r.type === 'retrieval');
  const refusal = results.filter((r) => r.type === 'refusal');
  const ratio = (arr) => (arr.length ? arr.filter((r) => r.passed).length / arr.length : null);

  return {
    config: { topK, minScore, embedProvider: env.embedProvider, vectorMode: env.vectorMode },
    hitRate: ratio(retrieval),
    mrr: retrieval.length ? retrieval.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / retrieval.length : null,
    refusalAccuracy: ratio(refusal),
    results,
  };
}
