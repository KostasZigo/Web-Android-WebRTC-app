const { once } = require('node:events');
const WebSocket = require('ws');
const Roulette = require('../src/roulette').default;

async function startServer(t) {
  const server = new WebSocket.Server({ host: '127.0.0.1', port: 0 });
  const roulette = new Roulette();
  server.on('connection', socket => roulette.register(socket));
  await once(server, 'listening');

  t.after(() => new Promise((resolve, reject) => {
    for (const socket of server.clients) {
      socket.terminate();
    }
    server.close(error => error ? reject(error) : resolve());
  }));

  return `ws://127.0.0.1:${server.address().port}`;
}

async function connectClient(t, url) {
  const socket = new WebSocket(url);
  const messages = [];
  const pending = [];
  let closeCode;

  socket.on('message', raw => {
    const next = pending.shift();
    if (next) {
      next.resolve(raw.toString());
    } else {
      messages.push(raw.toString());
    }
  });
  socket.on('close', code => {
    closeCode = code;
    for (const next of pending.splice(0)) {
      next.reject(new Error('Connection closed before a message arrived'));
    }
  });
  socket.on('error', error => {
    for (const next of pending.splice(0)) {
      next.reject(error);
    }
  });

  await once(socket, 'open');
  t.after(() => socket.terminate());

  return {
    send(message) {
      socket.send(JSON.stringify(message));
    },
    sendRaw(message) {
      socket.send(message);
    },
    async receive(timeoutMs = 2000) {
      if (messages.length) {
        return JSON.parse(messages.shift());
      }

      const raw = await new Promise((resolve, reject) => {
        const next = {
          resolve(value) {
            clearTimeout(timeout);
            resolve(value);
          },
          reject(error) {
            clearTimeout(timeout);
            reject(error);
          }
        };
        const timeout = setTimeout(() => {
          pending.splice(pending.indexOf(next), 1);
          reject(new Error('Timed out waiting for a signaling message'));
        }, timeoutMs);
        pending.push(next);
      });
      return JSON.parse(raw);
    },
    async closed() {
      if (closeCode === undefined) {
        await once(socket, 'close');
      }
      return closeCode;
    },
    async close() {
      if (socket.readyState === WebSocket.OPEN) {
        const closed = once(socket, 'close');
        socket.close();
        await closed;
      }
    }
  };
}

module.exports = { startServer, connectClient };
