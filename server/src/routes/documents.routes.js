import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler, httpError } from '../middleware/errorHandler.js';
import Chunk from '../models/Chunk.js';
import Document from '../models/Document.js';
import { processDocument } from '../services/ingest.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ['application/pdf', 'text/plain'].includes(file.mimetype) ? cb(null, true) : cb(httpError(400, 'Only PDF or .txt files are supported')),
});

const meta = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(100),
  ticker: z.string().max(10).optional(),
  fiscalYear: z.coerce.number().int().min(1990).max(2100).optional(),
  docType: z.enum(['10-K', '10-Q', 'annual-report', 'earnings-call', 'other']).default('other'),
});

const FREE_DOC_LIMIT = 3;

router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'Attach a PDF or .txt file');
  const body = meta.parse(Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== '')));

  if (req.user.role === 'free' && (await Document.countDocuments({ owner: req.user.id })) >= FREE_DOC_LIMIT) {
    throw httpError(403, `The free plan allows ${FREE_DOC_LIMIT} documents. Delete one or upgrade to Pro.`);
  }

  const doc = await Document.create({ ...body, owner: req.user.id, fileName: req.file.originalname });
  // Deliberately not awaited: respond now, process in the background, client polls status.
  processDocument(doc._id, req.file.buffer, req.file.mimetype);
  res.status(202).json(doc);
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await Document.find({ owner: req.user.id }).sort({ createdAt: -1 }));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const doc = await Document.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
  if (!doc) throw httpError(404, 'Document not found');
  await Chunk.deleteMany({ documentId: doc._id });
  res.json({ ok: true });
}));

export default router;
