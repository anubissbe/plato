import { runDoctor } from '../src/ops/doctor.js';
import { startProxy, stopProxy } from '../src/integrations/proxy.js';
import { getRoots } from '../src/context/context.js';
import { scanTodos, loadTodos } from '../src/todos/todos.js';
import { dryRunApply } from '../src/tools/patch.js';
import { attachServer, detachServer, callTool } from '../src/integrations/mcp.js';

async function main() {
  console.log('--- doctor');
  const doctor = await runDoctor();
  for (const l of doctor) console.log(' ', l);

  console.log('\n--- proxy start/stop');
  const port = await startProxy(18001);
  console.log(' proxy started on :', port);
  await stopProxy();
  console.log(' proxy stopped');

  console.log('\n--- todos scan/list');
  const roots = await getRoots();
  const list = await scanTodos(roots);
  console.log(' scanned todos:', list.length);
  const existing = await loadTodos();
  console.log(' loaded todos:', existing.length);

  console.log('\n--- patch engine (non-git)');
  try {
    await dryRunApply('');
    console.log(' ERROR: patch engine should have required git repo');
  } catch (e: any) {
    console.log(' expected error:', e?.message || String(e));
  }

  console.log('\n--- mcp (mock)');
  const id = 'local-smoke';
  const url = 'http://localhost:8719';
  try {
    await attachServer(id, url);
    const sum = await callTool(id, 'sum', { a: 2, b: 3 });
    console.log(' sum result:', JSON.stringify(sum));
  } catch (e: any) {
    console.log(' mcp error:', e?.message || String(e));
  } finally {
    await detachServer(id).catch(()=>{});
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

