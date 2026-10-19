import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import { questionLimiter } from '../middleware/rateLimit.js';
import Document from '../models/Document.js';
import { answerQuestion } from '../services/rag.js';

const router = Router();

const schema = z.object({
  question: z.string().trim().min(3).max(500),
  documentIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(3),
  mode: z.enum(['ask', 'compare']).default('ask'),
});

router.post('/', questionLimiter, asyncHandler(async (req, res) => {
  const body = schema.parse(req.body);
  if (body.mode === 'compare' && body.documentIds.length < 2) throw httpError(400, 'Pick at least two documents to compare');

  // Ownership check: users can only query their own, fully processed documents.
  const docs = await Document.find({ _id: { $in: body.documentIds }, owner: req.user.id, status: 'ready' });
  if (docs.length !== body.documentIds.length) throw httpError(404, 'One or more documents are unavailable');

  res.json(await answerQuestion({ docs, question: body.question, mode: body.mode }));
}));

export default router;
