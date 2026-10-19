import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import Document from '../models/Document.js';
import { runEvaluation } from '../services/evaluate.js';

const router = Router();

const schema = z.object({
  documentIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(3),
  topK: z.number().int().min(1).max(20).default(env.topK),
  cases: z.array(z.object({
    question: z.string().min(3).max(500),
    expectedPhrases: z.array(z.string().min(2)).optional(),
    expectNotFound: z.boolean().optional(),
  })).min(1).max(50),
});

router.post('/run', asyncHandler(async (req, res) => {
  const body = schema.parse(req.body);
  const docs = await Document.find({ _id: { $in: body.documentIds }, owner: req.user.id, status: 'ready' });
  if (docs.length !== body.documentIds.length) throw httpError(404, 'One or more documents are unavailable');
  res.json(await runEvaluation({ documentIds: docs.map((d) => d._id), cases: body.cases, topK: body.topK }));
}));

export default router;
