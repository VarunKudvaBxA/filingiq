import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  page: { type: Number, required: true },
  text: { type: String, required: true },
  // select:false keeps the large vector out of normal queries.
  embedding: { type: [Number], select: false },
});

export default mongoose.model('Chunk', chunkSchema);
