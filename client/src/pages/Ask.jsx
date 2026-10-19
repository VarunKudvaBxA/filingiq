import { useState } from 'react';
import { api } from '../api.js';
import DocPicker from '../components/DocPicker.jsx';

/** Turns "[2]" in the answer text into clickable markers that jump to the matching source card. */
function AnswerText({ text, onCite }) {
  return (
    <p className="answer">
      {text.split(/(\[\d+\])/g).map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        return m ? <button key={i} className="cite" onClick={() => onCite(Number(m[1]))} aria-label={`Source ${m[1]}`}>{m[1]}</button> : part;
      })}
    </p>
  );
}

export default function Ask() {
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState('ask');
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!selected.length) return setError('Select at least one document.');
    setBusy(true);
    setError('');
    try {
      const result = await api('/chat', { method: 'POST', body: { question, documentIds: selected, mode } });
      setThread((t) => [{ id: Date.now(), question, mode, ...result }, ...t]);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const jump = (id, n) => document.getElementById(`src-${id}-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div>
      <h1>Ask</h1>
      <DocPicker selected={selected} onChange={setSelected} />
      <form className="ask-form" onSubmit={submit}>
        <div className="seg" role="radiogroup" aria-label="Mode">
          <button type="button" className={mode === 'ask' ? 'on' : ''} onClick={() => setMode('ask')}>Ask a question</button>
          <button type="button" className={mode === 'compare' ? 'on' : ''} onClick={() => setMode('compare')}>Compare documents</button>
        </div>
        <textarea
          required rows={3} value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder={mode === 'compare' ? 'e.g. Compare the main risk factors of these companies' : 'e.g. What drove the change in operating margin?'}
        />
        <button className="primary" disabled={busy}>{busy ? 'Searching the documents…' : 'Get answer'}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      {thread.map((t) => (
        <article key={t.id} className="card result">
          <h3>{t.question}</h3>
          {t.grounded === false && t.citations.length === 0 ? (
            <p className="notfound">{t.answer}</p>
          ) : (
            <AnswerText text={t.answer} onCite={(n) => jump(t.id, n)} />
          )}
          {t.citations.length > 0 && (
            <ol className="sources">
              {t.citations.map((c) => (
                <li key={c.n} id={`src-${t.id}-${c.n}`}>
                  <div className="src-head"><span className="cite static">{c.n}</span>{c.label} · page {c.page}<span className="score">match {c.score}</span></div>
                  <blockquote>{c.snippet}…</blockquote>
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
    </div>
  );
}
