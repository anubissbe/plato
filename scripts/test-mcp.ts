import { attachServer, listTools, callTool, detachServer } from '../src/integrations/mcp.js';

async function main() {
  const id = 'local';
  const url = 'http://localhost:8719';
  try {
    await attachServer(id, url);
    const tools = await listTools(id);
    console.log('tools:', JSON.stringify(tools));
    const out = await callTool(id, 'echo', { text: 'hello' });
    console.log('echo:', JSON.stringify(out));
    const sum = await callTool(id, 'sum', { a: 2, b: 5 });
    console.log('sum:', JSON.stringify(sum));
  } finally {
    await detachServer(id).catch(()=>{});
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });

