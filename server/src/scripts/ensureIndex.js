// Creates the Atlas Vector Search index used when VECTOR_MODE=atlas.
// Works on Atlas clusters and on the mongodb-atlas-local Docker image.
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import Chunk from '../models/Chunk.js';

await connectDb();
await Chunk.createCollection().catch(() => {});

const collection = mongoose.connection.db.collection(Chunk.collection.collectionName);
const existing = await collection.listSearchIndexes().toArray();

if (existing.some((i) => i.name === env.vectorIndex)) {
  console.log(`Index "${env.vectorIndex}" already exists`);
} else {
  await collection.createSearchIndex({
    name: env.vectorIndex,
    type: 'vectorSearch',
    definition: {
      fields: [
        { type: 'vector', path: 'embedding', numDimensions: env.embedDims, similarity: 'cosine' },
        { type: 'filter', path: 'documentId' }, // needed for the pre-filter in $vectorSearch
      ],
    },
  });
  console.log(`Created index "${env.vectorIndex}" (${env.embedDims} dims). It may take a minute to become queryable.`);
}
await mongoose.disconnect();
