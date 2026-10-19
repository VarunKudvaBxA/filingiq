import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { attachMarket } from './sockets/market.js';

await connectDb();

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.clientUrl, credentials: true } });
attachMarket(io);

server.listen(env.port, () => console.log(`FilingIQ API on :${env.port} (chat=${env.chatProvider}, embed=${env.embedProvider}, vector=${env.vectorMode})`));
