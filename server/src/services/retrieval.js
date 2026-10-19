import { env } from '../config/env.js';
import Chunk from '../models/Chunk.js';

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

/**
 * Returns the top-k chunks (with a similarity score) for the given documents.
 * atlas mode: MongoDB Atlas $vectorSearch with a pre-filter on documentId.
 * local mode: brute-force cosine in Node. Fine for development and small corpora.
 */
export async function retrieve({ documentIds, queryEmbedding, k = env.topK }) {
  if (env.vectorMode === 'atlas') {
    return Chunk.aggregate([
      {
        $vectorSearch: {
          index: env.vectorIndex,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: Math.max(100, k * 20),
          limit: k,
          filter: { documentId: { $in: documentIds } },
        },
      },
      { $project: { text: 1, page: 1, documentId: 1, score: { $meta: 'vectorSearchScore' } } },
    ]);
  }

  const chunks = await Chunk.find({ documentId: { $in: documentIds } }).select('+embedding').lean();
  return chunks
    .map((c) => ({ _id: c._id, text: c.text, page: c.page, documentId: c.documentId, score: cosine(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
