import http from 'http';

const PORT = Number(process.env.PORT || 8719);

const tools = [
  { id: 'echo', name: 'echo', description: 'Echo input', input_schema: { type: 'object', properties: { text: { type: 'string' } } } },
  { id: 'sum', name: 'sum', description: 'Sum numbers', input_schema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } } }
];

const srv = http.createServer((req, res) => {
  const url = req.url || '/';
  if (req.method === 'GET' && (url === '/tools' || url === '/.well-known/mcp/tools')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools: tools.map(({ id, ...rest }) => rest) }));
    return;
  }
  if (req.method === 'POST' && url.startsWith('/tools/')) {
    const name = decodeURIComponent(url.split('/').pop()||'');
    let body = '';
    req.on('data', c=>body+=c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body||'{}');
        const input = payload.input || payload || {};
        if (name === 'echo') {
          ok(res, { ok: true, output: input });
          return;
        }
        if (name === 'sum') {
          ok(res, { ok: true, result: Number(input.a||0) + Number(input.b||0) });
          return;
        }
        notFound(res);
      } catch (e:any) {
        error(res, e?.message || String(e));
      }
    });
    return;
  }
  notFound(res);
});

function ok(res: http.ServerResponse, data: any) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function notFound(res: http.ServerResponse) {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
}
function error(res: http.ServerResponse, msg: string) {
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: msg }));
}

srv.listen(PORT, () => {
  console.log(`Mock MCP server listening on ${PORT}`);
});

process.on('SIGTERM', ()=> srv.close(()=>process.exit(0)));
process.on('SIGINT', ()=> srv.close(()=>process.exit(0)));

