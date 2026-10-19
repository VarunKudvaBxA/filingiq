import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPES = ['10-K', '10-Q', 'annual-report', 'earnings-call', 'other'];
const empty = { title: '', company: '', ticker: '', fiscalYear: '', docType: '10-K' };

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/documents').then(setDocs).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  // Poll while anything is still being processed.
  useEffect(() => {
    if (!docs.some((d) => d.status === 'processing')) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [docs, load]);

  async function upload(e) {
    e.preventDefault();
    if (!file) return setError('Choose a PDF or .txt file first.');
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      data.append('file', file);
      Object.entries(form).forEach(([k, v]) => v !== '' && data.append(k, v));
      await api('/documents', { method: 'POST', body: data });
      setForm(empty);
      setFile(null);
      e.target.reset();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const remove = async (id) => { await api(`/documents/${id}`, { method: 'DELETE' }); load(); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1>Documents</h1>
      <form className="card grid-form" onSubmit={upload}>
        <label>File<input type="file" accept="application/pdf,text/plain" onChange={(e) => setFile(e.target.files[0])} /></label>
        <label>Title<input required value={form.title} onChange={set('title')} placeholder="Annual report 2024" /></label>
        <label>Company<input required value={form.company} onChange={set('company')} placeholder="Apple Inc." /></label>
        <label>Ticker<input value={form.ticker} onChange={set('ticker')} placeholder="AAPL" maxLength={10} /></label>
        <label>Fiscal year<input type="number" value={form.fiscalYear} onChange={set('fiscalYear')} placeholder="2024" /></label>
        <label>Type<select value={form.docType} onChange={set('docType')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <button className="primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload document'}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      {docs.length === 0 ? (
        <p className="empty">No documents yet. Upload a 10-K or annual report to start asking questions.</p>
      ) : (
        <table className="table">
          <thead><tr><th>Document</th><th>Company</th><th>Pages</th><th>Status</th><th /></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d._id}>
                <td>{d.title}<div className="hint">{d.docType}{d.fiscalYear ? ` · ${d.fiscalYear}` : ''}</div></td>
                <td>{d.company}{d.ticker ? ` (${d.ticker})` : ''}</td>
                <td>{d.pageCount || '–'}</td>
                <td><span className={`badge ${d.status}`}>{d.status === 'processing' ? 'Processing…' : d.status === 'ready' ? 'Ready' : 'Failed'}</span>{d.error && <div className="hint">{d.error}</div>}</td>
                <td><button className="link" onClick={() => remove(d._id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
