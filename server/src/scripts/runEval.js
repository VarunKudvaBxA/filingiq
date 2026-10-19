// Usage: npm run eval -- <documentId[,documentId]> eval/my-testset.json [topK]
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { runEvaluation } from '../services/evaluate.js';

const [ids, file, topK] = process.argv.slice(2);
if (!ids || !file) {
  console.error('Usage: npm run eval -- <documentId[,documentId]> <testset.json> [topK]');
  process.exit(1);
}

await connectDb();
const cases = JSON.parse(fs.readFileSync(file, 'utf8'));
const report = await runEvaluation({
  documentIds: ids.split(',').map((id) => new mongoose.Types.ObjectId(id)),
  cases,
  ...(topK ? { topK: Number(topK) } : {}),
});

console.log(JSON.stringify(report.config));
console.table(report.results.map((r) => ({ question: r.question.slice(0, 60), type: r.type, passed: r.passed, rank: r.rank ?? '-', topScore: r.topScore.toFixed(3) })));
const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
console.log(`hit@k: ${pct(report.hitRate)} | MRR: ${report.mrr?.toFixed(3) ?? 'n/a'} | refusal accuracy: ${pct(report.refusalAccuracy)}`);
await mongoose.disconnect();
