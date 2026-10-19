import { useState } from 'react';
import { api } from '../api.js';
import DocPicker from '../components/DocPicker.jsx';

const TEMPLATE = `[
  { "question": "What was total net revenue for the year?", "expectedPhrases": ["total net revenue"] },
  { "question": "What risks does the company mention about suppliers?", "expectedPhrases": ["supplier", "supply chain"] },
  { "question": "What is the recipe for chocolate cake?", "expectNotFound": true }
]`;

const pct = (x) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(0)}%`);

export default function Evaluation() {
  const [selected, setSelected] = useState([]);
  const [cases, setCases] = useState(TEMPLATE);
  const [topK, setTopK] = useState(5);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    setError('');
    setReport(null);
    let parsed;
    try { parsed = JSON.parse(cases); } catch { return setError('Test cases must be valid JSON.'); }
    if (!selected.length) return setError('Select at least one document.');
    setBusy(true);
    try {
      setReport(await api('/eval/run', { method: 'POST', body: { documentIds: selected, cases: parsed, topK: Number(topK) } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Evaluation</h1>
      <p className="lead">Write questions together with a phrase that must appear in the right passage. The test checks whether retrieval finds it, so you can change settings and see the effect on the score.</p>
      <DocPicker selected={selected} onChange={setSelected} />
      <label className="block">Test cases (JSON)<textarea rows={9} value={cases} onChange={(e) => setCases(e.target.value)} spellCheck={false} /></label>
      <label className="inline">Passages retrieved (top k)<input type="number" min={1} max={20} value={topK} onChange={(e) => setTopK(e.target.value)} /></label>
      <button className="primary" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run evaluation'}</button>
      {error && <p className="error" role="alert">{error}</p>}

      {report && (
        <div className="card">
          <div className="metrics">
            <div><strong>{pct(report.hitRate)}</strong><span>Right passage found</span></div>
            <div><strong>{report.mrr === null ? 'n/a' : report.mrr.toFixed(2)}</strong><span>Average rank score (MRR)</span></div>
            <div><strong>{pct(report.refusalAccuracy)}</strong><span>Correctly said "not found"</span></div>
          </div>
          <table className="table">
            <thead><tr><th>Question</th><th>Result</th><th>Rank</th><th>Top match</th></tr></thead>
            <tbody>
              {report.results.map((r, i) => (
                <tr key={i}>
                  <td>{r.question}</td>
                  <td><span className={`badge ${r.passed ? 'ready' : 'failed'}`}>{r.passed ? 'Pass' : 'Miss'}</span></td>
                  <td>{r.rank ?? '–'}</td>
                  <td>{r.topScore.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Embeddings: {report.config.embedProvider} · retrieval: {report.config.vectorMode} · min score {report.config.minScore}</p>
        </div>
      )}
    </div>
  );
}
