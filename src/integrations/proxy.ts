import http from 'http';
import { chatCompletions, chatStream } from '../providers/chat_fallback.js';

let server: http.Server | null = null;

export async function startProxy(port = 11434) {
  if (server) return port;
  server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url?.endsWith('/v1/chat/completions')) {
      let body = '';
      req.on('data', (c) => body += c);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const messages = payload.messages || [];
          const model = payload.model;
          const stream = !!payload.stream;
          if (stream) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
            await chatStream(messages, { model }, (delta) => {
              const chunk = { id: 'plato-proxy', choices: [{ delta: { content: delta } }], object: 'chat.completion.chunk' } as any;
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            });
            res.write('data: [DONE]\n\n');
            res.end();
          } else {
            const { content, usage } = await chatCompletions(messages, { model });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: 'plato-proxy', choices: [{ message: { role: 'assistant', content } }], usage }));
          }
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: e?.message || String(e) } }));
        }
      });
      return;
    }
    res.statusCode = 404;
    res.end('Not Found');
  });
  await new Promise<void>(resolve => server!.listen(port, resolve));
  return port;
}

export async function stopProxy() {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(()=>resolve()));
  server = null;
}
