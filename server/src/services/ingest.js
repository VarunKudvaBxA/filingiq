import Chunk from '../models/Chunk.js';
import Document from '../models/Document.js';
import { chunkPages } from './chunker.js';
import { embed } from './llm.js';
import { extractPages } from './pdf.js';

/**
 * Runs in the background after the upload response has been sent:
 * extract pages -> chunk -> embed in batches -> store. Updates the document status when done.
 */
export async function processDocument(documentId, buffer, mimetype) {
  try {
    const pages = await extractPages(buffer, mimetype);
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new Error('No readable text found. Scanned PDFs need OCR first.');

    const vectors = await embed(chunks.map((c) => c.text));
    await Chunk.insertMany(chunks.map((c, i) => ({ documentId, page: c.page, text: c.text, embedding: vectors[i] })));

    await Document.findByIdAndUpdate(documentId, { status: 'ready', pageCount: pages.length, chunkCount: chunks.length });
  } catch (err) {
    console.error('Ingest failed', documentId, err.message);
    await Chunk.deleteMany({ documentId });
    await Document.findByIdAndUpdate(documentId, { status: 'failed', error: err.message });
  }
}
