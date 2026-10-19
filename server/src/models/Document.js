import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    ticker: { type: String, trim: true, uppercase: true },
    fiscalYear: Number,
    docType: { type: String, enum: ['10-K', '10-Q', 'annual-report', 'earnings-call', 'other'], default: 'other' },
    fileName: String,
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
    error: String,
  },
  { timestamps: true }
);

export default mongoose.model('Document', documentSchema);
