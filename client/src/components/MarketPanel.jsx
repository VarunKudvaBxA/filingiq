import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, getToken } from '../api.js';

export default function MarketPanel() {
  const [tickers, setTickers] = useState(['AAPL', 'MSFT']);
  const [input, setInput] = useState('');
  const [quotes, setQuotes] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API_URL || undefined, { auth: { token: getToken() } });
    socketRef.current = socket;
    socket.on('quote', (q) => setQuotes((prev) => ({ ...prev, [q.ticker]: q })));
    return () => socket.disconnect();
  }, []);

  // Re-subscribe whenever the list changes (and after reconnects).
  useEffect(() => {
    const socket = socketRef.current;
    const subscribe = () => socket.emit('subscribe', tickers);
    subscribe();
    socket.on('connect', subscribe);
    return () => socket.off('connect', subscribe);
  }, [tickers]);

  function add(e) {
    e.preventDefault();
    const t = input.trim().toUpperCase();
    if (/^[A-Z.]{1,6}$/.test(t) && !tickers.includes(t) && tickers.length < 10) setTickers([...tickers, t]);
    setInput('');
  }

  const anySimulated = Object.values(quotes).some((q) => q.source === 'simulated');

  return (
    <aside className="market">
      <h3>Watchlist</h3>
      <ul>
        {tickers.map((t) => {
          const q = quotes[t];
          return (
            <li key={t}>
              <span className="sym">{t}</span>
              <span className="px">{q ? q.price.toFixed(2) : '…'}</span>
              <span className={q && q.changePct >= 0 ? 'up' : 'down'}>{q ? `${q.changePct >= 0 ? '+' : ''}${q.changePct}%` : ''}</span>
              <button className="x" aria-label={`Remove ${t}`} onClick={() => setTickers(tickers.filter((x) => x !== t))}>×</button>
            </li>
          );
        })}
      </ul>
      <form onSubmit={add}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add ticker" aria-label="Add ticker" maxLength={6} />
      </form>
      {anySimulated && <p className="hint">Prices are simulated. Add a Finnhub key on the server for live quotes.</p>}
    </aside>
  );
}
