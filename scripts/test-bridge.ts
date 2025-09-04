import assert from 'node:assert';
import { attachServer, detachServer, callTool } from '../src/integrations/mcp.js';

async function main() {
  const id = 'local-test';
  const url = 'http://localhost:8719';
  try {
    await attachServer(id, url);
    const out = await callTool(id, 'sum', { a: 4, b: 6 });
    const n = Number((out as any)?.result ?? NaN);
    assert.strictEqual(n, 10, 'sum tool should return 10');
    console.log('OK test-bridge: mcp sum=10');
  } finally {
    await detachServer(id).catch(()=>{});
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });

