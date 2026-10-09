import { WebSocketServer } from 'ws';
import Roulette from './roulette';

const rawPort = process.env.PORT ?? '8000';
const port = Number(rawPort);
if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port > 65535) {
  throw new RangeError('PORT must be a number between 0 and 65535');
}

const server = new WebSocketServer({ port });
const roulette = new Roulette();

server.on('connection', socket => roulette.register(socket));
server.on('listening', () => {
  const address = server.address();
  if (address === null) throw new Error('Signaling server has no listening address');
  console.info(`Signaling server listening on ${typeof address === 'string' ? address : address.port}`);
});
server.on('error', error => {
  console.error('Signaling server failed:', error);
  process.exitCode = 1;
});