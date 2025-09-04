import fs from 'fs/promises';

async function main() {
  const results: string[] = [];

  // 1) Config default check
  const { loadConfig } = await import('../src/config.js');
  const cfg = await loadConfig();
  results.push(`config.editing.autoApply=${cfg.editing?.autoApply}`);

  // 2) Patch engine apply a simple new file
  const { dryRunApply, apply } = await import('../src/tools/patch.js');
  const diff = `*** Begin Patch ***\n\n\n--- /dev/null\n+++ hello_parity.txt\n@@ -0,0 +1,1 @@\n+hello parity\n\n*** End Patch ***`;
  const dry = await dryRunApply(diff);
  results.push(`patch.dryRun.ok=${dry.ok}`);
  if (!dry.ok) results.push(`patch.dryRun.conflicts=${dry.conflicts.join(' | ')}`);
  if (dry.ok) {
    await apply(diff);
    const txt = await fs.readFile('hello_parity.txt', 'utf8');
    results.push(`patch.apply.exists=${txt.trim() === 'hello parity'}`);
  }

  // 3) Hooks manager
  const { manageHooks } = await import('../src/tools/hooks.js');
  const out1 = await manageHooks('/hooks list');
  results.push(`hooks.list.count=${out1.length}`);
  const out2 = await manageHooks('/hooks add pre-prompt echo parity');
  results.push(`hooks.add=${out2[0]}`);
  const out3 = await manageHooks('/hooks list');
  results.push(`hooks.list.after=${out3.length}`);

  // 4) Bashes manager
  const { handleBashCommand } = await import('../src/tools/bashes.js');
  const b1 = await handleBashCommand('/bashes list');
  results.push(`bashes.list.before=${b1.length}`);
  const b2 = await handleBashCommand('/bashes new');
  results.push(`bashes.new=${b2[0]}`);
  const b3 = await handleBashCommand('/bashes list');
  results.push(`bashes.list.after=${b3.length}`);
  // kill newest by id prefix in message
  const idPrefixMatch = (b2[0].match(/: (\w{8})$/) || [])[1];
  if (idPrefixMatch) {
    const b4 = await handleBashCommand(`/bashes kill ${idPrefixMatch}`);
    results.push(`bashes.kill=${b4[0]}`);
  }

  // 5) MCP call retry (optional - no server)
  const { callTool, attachServer, detachServer } = await import('../src/integrations/mcp.js');
  try {
    await attachServer('local-self', 'http://localhost:8719');
    try {
      await callTool('local-self', 'sum', { a: 1, b: 2 });
      results.push('mcp.call=ok');
    } catch (e: any) {
      results.push(`mcp.call=err(${e?.message||e})`);
    } finally {
      await detachServer('local-self').catch(()=>{});
    }
  } catch {}

  // 6) Export
  const { orchestrator } = await import('../src/runtime/orchestrator.js');
  await orchestrator.exportJSON('.plato/self-check.json');
  results.push('export.json=ok');
  await orchestrator.exportMarkdown('.plato/self-check.md');
  results.push('export.md=ok');

  console.log(results.join('\n'));
}

main().catch((e)=>{ console.error(e); process.exit(1); });

