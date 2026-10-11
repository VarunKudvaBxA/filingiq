import { useEffect, useState } from 'react';
import { api } from '../api.js';

/** Loads ready documents and lets the user tick up to `max` of them. */
export default function DocPicker({ selected, onChange, max = 3 }) {
  const [docs, setDocs] = useState([]);
  useEffect(() => { api('/documents').then((all) => setDocs(all.filter((d) => d.status === 'ready'))); }, []);

  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  };

  if (!docs.length) return <p className="empty">No processed documents yet. Upload one on the Documents page.</p>;
  return (
    <fieldset className="picker">
      <legend>Documents (up to {max})</legend>
      {docs.map((d) => (
        <label key={d._id} className={selected.includes(d._id) ? 'chip on' : 'chip'}>
          <input type="checkbox" checked={selected.includes(d._id)} onChange={() => toggle(d._id)} />
          {d.company} · {d.title}
        </label>
      ))}
    </fieldset>
  );
}
