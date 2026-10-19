import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const TICKER = /^[A-Z.]{1,6}$/;
const simulated = new Map();

async function getQuote(ticker) {
  if (env.finnhubKey) {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${env.finnhubKey}`);
    if (res.ok) {
      const q = await res.json();
      if (q.c) return { price: q.c, previousClose: q.pc, source: 'finnhub' };
    }
  }
  // No key (or API error): random walk so the panel still works in demos. Labelled as simulated.
  let state = simulated.get(ticker);
  if (!state) {
    const base = 50 + (([...ticker].reduce((s, c) => s + c.charCodeAt(0), 0) * 7) % 400);
    state = { price: base, previousClose: base };
  }
  state.price = Math.max(1, state.price * (1 + (Math.random() - 0.5) * 0.006));
  simulated.set(ticker, state);
  return { price: Number(state.price.toFixed(2)), previousClose: state.previousClose, source: 'simulated' };
}

/**
 * Clients send `subscribe` with a list of tickers. The server polls each subscribed ticker once per
 * interval (not once per client) and broadcasts to that ticker's room.
 */
export function attachMarket(io) {
  const watchers = new Map(); // ticker -> number of sockets watching

  io.use((socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, env.jwtAccessSecret);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.data.tickers = new Set();

    socket.on('subscribe', (tickers = []) => {
      const next = new Set(
        (Array.isArray(tickers) ? tickers : []).map((t) => String(t).toUpperCase()).filter((t) => TICKER.test(t)).slice(0, 10)
      );
      for (const t of socket.data.tickers) {
        if (!next.has(t)) {
          socket.leave(`t:${t}`);
          watchers.set(t, (watchers.get(t) || 1) - 1);
        }
      }
      for (const t of next) {
        if (!socket.data.tickers.has(t)) {
          socket.join(`t:${t}`);
          watchers.set(t, (watchers.get(t) || 0) + 1);
        }
      }
      socket.data.tickers = next;
    });

    socket.on('disconnect', () => {
      for (const t of socket.data.tickers) watchers.set(t, (watchers.get(t) || 1) - 1);
    });
  });

  setInterval(async () => {
    for (const [ticker, count] of watchers) {
      if (count <= 0) continue;
      try {
        const q = await getQuote(ticker);
        const change = q.previousClose ? ((q.price - q.previousClose) / q.previousClose) * 100 : 0;
        io.to(`t:${ticker}`).emit('quote', { ticker, price: q.price, changePct: Number(change.toFixed(2)), source: q.source, ts: Date.now() });
      } catch (err) {
        console.error('quote failed', ticker, err.message);
      }
    }
  }, 5000);
}
