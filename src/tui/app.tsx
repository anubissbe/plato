import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, render, useApp, useInput, useStdin } from 'ink';
import { loadConfig, setConfigValue } from '../config.js';
import { SLASH_COMMANDS } from '../slash/commands.js';
import { orchestrator } from '../runtime/orchestrator.js';

export async function runTui() {
  const ui = render(<App />);
  await ui.waitUntilExit();
}

function App() {
  const { exit } = useApp();
  const { stdin, setRawMode, isRawModeSupported } = useStdin();
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<string[]>(["Welcome to Plato. Type /help to get started."]);
  const [status, setStatus] = useState<string>('');
  const [cfg, setCfg] = useState<any>(null);
  const [confirm, setConfirm] = useState<null | { question: string; proceed: () => Promise<void> }>(null);
  const [keyDebug, setKeyDebug] = useState<boolean>(false);

  useEffect(() => { (async () => setCfg(await loadConfig()))(); }, []);

  // Ensure raw mode so we can capture control keys reliably (WSL-friendly)
  useEffect(() => {
    try { if (isRawModeSupported) setRawMode?.(true); } catch {}
    return () => { try { if (isRawModeSupported) setRawMode?.(false); } catch {} };
  }, [setRawMode, isRawModeSupported]);

  // Raw stdin fallback for backspace across terminals (WSL, etc.)
  useEffect(() => {
    if (!stdin) return;
    const onData = (data: any) => {
      const buf: Buffer = Buffer.isBuffer(data) ? data : (typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data));
      if (keyDebug) {
        const bytes = Array.from(buf.values());
        const hex = bytes.map(b=>b.toString(16).padStart(2,'0')).join(' ');
        const dec = bytes.join(' ');
        const names = bytes.map(b => {
          if (b===0x7f) return 'DEL';
          if (b===0x08) return 'BS';
          if (b===0x1b) return 'ESC';
          if (b===0x0d) return 'CR';
          if (b===0x0a) return 'LF';
          if (b===0x09) return 'TAB';
          const ch = String.fromCharCode(b);
          return b < 32 ? `^${String.fromCharCode(b+64)}` : ch;
        }).join(' ');
        setLines(prev=>prev.concat(`keydebug: dec=[${dec}] hex=[${hex}] names=[${names}]`));
        if (bytes.includes(0x7f) || bytes.includes(0x08)) setKeyDebug(false);
      }
      // Handle DEL (0x7F) and BS (0x08)
      for (const b of buf) {
        if (b === 0x7f || b === 0x08) {
          setInput(s => s.slice(0, -1));
          // Don't break; allow multiple repeats in one chunk
        }
      }
    };
    // @ts-ignore node types
    stdin.on('data', onData);
    return () => { /* @ts-ignore */ stdin.off?.('data', onData); };
  }, [stdin]);

  // Process-level stdin capture when /keydebug is armed (works even if Ink stdin misses it)
  useEffect(() => {
    if (!keyDebug) return;
    const ps = process.stdin as any;
    const restore: { raw?: boolean } = {};
    try {
      if (ps.setRawMode) {
        restore.raw = (ps as any).isRaw;
        ps.setRawMode(true);
      }
      if (ps.resume) ps.resume();
    } catch {}
    const onDataProc = (data: any) => {
      const buf: Buffer = Buffer.isBuffer(data) ? data : (typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data));
      const bytes = Array.from(buf.values());
      const hex = bytes.map(b=>b.toString(16).padStart(2,'0')).join(' ');
      const dec = bytes.join(' ');
      const names = bytes.map(b => {
        if (b===0x7f) return 'DEL';
        if (b===0x08) return 'BS';
        if (b===0x1b) return 'ESC';
        if (b===0x0d) return 'CR';
        if (b===0x0a) return 'LF';
        if (b===0x09) return 'TAB';
        const ch = String.fromCharCode(b);
        return b < 32 ? `^${String.fromCharCode(b+64)}` : ch;
      }).join(' ');
      setLines(prev=>prev.concat(`keydebug(proc): dec=[${dec}] hex=[${hex}] names=[${names}]`));
      if (bytes.includes(0x7f) || bytes.includes(0x08)) setKeyDebug(false);
    };
    ps.on('data', onDataProc);
    return () => {
      try { ps.off?.('data', onDataProc); } catch {}
      try { if (ps.setRawMode && restore.raw === false) ps.setRawMode(false); } catch {}
    };
  }, [keyDebug]);

  useInput((inputKey, key) => {
    if (confirm) {
      // simple confirm: y/n
      if (inputKey.toLowerCase() === 'y') {
        const fn = confirm.proceed;
        setConfirm(null);
        fn().catch(e=>setLines(prev=>prev.concat(`error: ${e?.message||e}`)));
      } else if (inputKey.toLowerCase() === 'n' || key.escape) {
        setConfirm(null);
        setLines(prev=>prev.concat('cancelled.'));
      }
      return;
    }
    if (key.return) {
      handleSubmit();
      return;
    }
    if (key.ctrl && inputKey === 'c') {
      exit();
      return;
    }
    // Backspace handling: support DEL (0x7F), BS (0x08), and Ctrl-H
    if (inputKey === '\u007F' || inputKey === '\b' || (key.ctrl && inputKey.toLowerCase() === 'h')) { setInput(s => s.slice(0, -1)); return; }
    else if (key.leftArrow || key.rightArrow || key.upArrow || key.downArrow) {
      // ignore
    } else {
      const code = inputKey && inputKey.length === 1 ? inputKey.charCodeAt(0) : NaN;
      if (!Number.isNaN(code)) {
        if (code < 32 || code === 127) return; // ignore control chars
      }
      if (inputKey === '\u001b') return; // ignore bare ESC
      setInput(s => s + inputKey);
    }
  });

  const [branch, setBranch] = useState<string>('');
  useEffect(() => { (async () => { try { const { default: simpleGit } = await import('simple-git'); const git = simpleGit(); const s = await git.status(); setBranch(s.current || ''); } catch {} })(); }, []);
  const statusline = useMemo(() => {
    const fmt = cfg?.statusline?.format || 'plato | {provider} | {model} | {tokens} {branch}';
    const m = orchestrator.getMetrics();
    const tokens = `tok ${m.inputTokens}/${m.outputTokens}`;
    const map: Record<string, string> = {
      provider: cfg?.provider?.active || 'copilot',
      model: cfg?.model?.active || 'unknown-model',
      tokens,
      branch: branch ? `git:${branch}` : '',
      cwd: process.cwd(),
      mode: 'chat',
      duration: `${m.durationMs}ms`,
      turns: String(m.turns),
    };
    return fmt.replace(/\{(\w+)\}/g, (_: string, k: string) => map[k] ?? '');
  }, [cfg, branch]);

  async function handleSubmit() {
    const text = input.trim();
    setInput('');
    if (!text) return;
    if (text.startsWith('/')) {
      if (text === '/help') {
        setLines(prev => prev.concat('Commands:', ...SLASH_COMMANDS.map(c => ` ${c.name} — ${c.summary}`)));
        return;
      }
      // For now, echo; wiring each handler incrementally
      setLines(prev => prev.concat(`(command) ${text}`));
      if (text === '/status') {
        const cfg = await loadConfig();
        const { getAuthInfo } = await import('../providers/copilot.js');
        const auth = await getAuthInfo();
        setLines(prev => prev.concat(`status: provider=${cfg.provider?.active} model=${cfg.model?.active} account=${auth.user?.login ?? (auth.loggedIn ? 'logged-in' : 'logged-out')}`));
      }
      if (text === '/keydebug') {
        setKeyDebug(true);
        setLines(prev=>prev.concat('keydebug: armed. Press your Backspace now; first key bytes will be printed.'));
        return;
      }
      if (text === '/login') {
        const { loginCopilot } = await import('../providers/copilot.js');
        await loginCopilot();
        setLines(prev => prev.concat('Logged in.'));
      }
      if (text === '/logout') {
        const { logoutCopilot } = await import('../providers/copilot.js');
        await logoutCopilot();
        setLines(prev => prev.concat('Logged out.'));
      }
      if (text.startsWith('/model')) {
        const cfg = await loadConfig();
        const parts = text.split(/\s+/);
        if (parts[1] === 'set' && parts[2]) {
          await setConfigValue('model', JSON.stringify({ active: parts[2] }));
          setCfg(await loadConfig());
          setLines(prev => prev.concat(`model set to ${parts[2]}`));
        } else {
          const cats = (cfg as any).model?.catalogs || {};
          const list: string[] = [];
          for (const [prov, arr] of Object.entries<any>(cats)) {
            list.push(`provider=${prov}: ${(arr as any[]).map(m=>m.id).join(', ')}`);
          }
          setLines(prev => prev.concat(`active=${cfg.model?.active}`, ...list));
        }
      }
      if (text.startsWith('/add-dir')) {
        const parts = text.split(/\s+/).slice(1).filter(Boolean);
        if (!parts.length) { setLines(prev=>prev.concat('usage: /add-dir <path>')); return; }
        const { addRoot, getRoots } = await import('../context/context.js');
        for (const p of parts) await addRoot(p);
        const roots = await getRoots();
        setLines(prev=>prev.concat(`roots:`, ...roots.map(r=>` - ${r}`)));
      }
      if (text.startsWith('/tool-call-preset')) {
        const parts = text.split(/\s+/);
        if (!parts[1] || parts[1] === 'status') {
          const cfg = await loadConfig();
          setLines(prev=>prev.concat(`tool_call preset enabled=${cfg.toolCallPreset?.enabled!==false}`));
          return;
        }
        if (parts[1] === 'on' || parts[1] === 'off') {
          const enabled = parts[1] === 'on';
          await setConfigValue('toolCallPreset', JSON.stringify({ enabled }));
          setCfg(await loadConfig());
          setLines(prev=>prev.concat(`tool_call preset ${enabled?'enabled':'disabled'}`));
          return;
        }
        if ((parts[1] === 'strict' || parts[1] === 'heuristics') && (parts[2] === 'on' || parts[2] === 'off')) {
          const cfg = await loadConfig();
          const current = cfg.toolCallPreset || {};
          if (parts[1] === 'strict') current.strictOnly = parts[2] === 'on';
          if (parts[1] === 'heuristics') current.allowHeuristics = parts[2] === 'on';
          await setConfigValue('toolCallPreset', JSON.stringify(current));
          setCfg(await loadConfig());
          setLines(prev=>prev.concat(`tool_call ${parts[1]} set to ${parts[2]}`));
          return;
        }
        if (parts[1] === 'override') {
          const msg = parts.slice(2).join(' ');
          const cfg = await loadConfig();
          const current = cfg.toolCallPreset || {};
          current.messageOverride = msg || '';
          await setConfigValue('toolCallPreset', JSON.stringify(current));
          setCfg(await loadConfig());
          setLines(prev=>prev.concat(msg ? 'override set.' : 'override cleared.'));
          return;
        }
        if (parts[1] === 'per-model') {
          const model = (parts[2]||'').trim();
          const msg = parts.slice(3).join(' ');
          if (!model) { setLines(prev=>prev.concat('usage: /tool-call-preset per-model <modelId> <message...>')); return; }
          const cfg = await loadConfig();
          const current = cfg.toolCallPreset || {};
          current.overrides = current.overrides || {};
          if (msg) current.overrides[model] = msg; else delete current.overrides[model];
          await setConfigValue('toolCallPreset', JSON.stringify(current));
          setCfg(await loadConfig());
          setLines(prev=>prev.concat(msg ? `override set for ${model}.` : `override cleared for ${model}.`));
          return;
        }
        setLines(prev=>prev.concat('usage: /tool-call-preset [status|on|off|strict on|off|heuristics on|off|override <message...>|per-model <modelId> <message...>]'));
        return;
      }
      if (text.startsWith('/proxy')) {
        const parts = text.split(/\s+/).slice(1);
        const sub = parts[0] || 'start';
        if (sub === 'start') {
          const iPort = parts.indexOf('--port');
          const port = iPort >= 0 ? Number(parts[iPort+1]) : undefined;
          const { startProxy } = await import('../integrations/proxy.js');
          const p = await startProxy(port || 11434);
          setLines(prev=>prev.concat(`proxy started on :${p}`));
          return;
        }
        if (sub === 'stop') {
          const { stopProxy } = await import('../integrations/proxy.js');
          await stopProxy();
          setLines(prev=>prev.concat('proxy stopped.'));
          return;
        }
        setLines(prev=>prev.concat('usage: /proxy [start|stop] [--port N]'));
        return;
      }
      if (text.startsWith('/todos')) {
        const parts = text.split(/\s+/).slice(1);
        if (!parts.length || parts[0] === 'list') {
          const { loadTodos } = await import('../todos/todos.js');
          const todos = await loadTodos();
          if (!todos.length) { setLines(prev=>prev.concat('todos: none')); return; }
          setLines(prev=>prev.concat('todos:', ...todos.map(t=>` - [${t.done?'x':' '}] ${t.id} ${t.text}`)));
          return;
        }
        if (parts[0] === 'scan') {
          const { getRoots } = await import('../context/context.js');
          const { scanTodos } = await import('../todos/todos.js');
          const roots = await getRoots();
          const list = await scanTodos(roots);
          setLines(prev=>prev.concat(`scanned: ${list.length} todos`, ...list.map(t=>` - ${t.id} ${t.text}`)));
          return;
        }
        if (parts[0] === 'done' && parts[1]) {
          const { markDone } = await import('../todos/todos.js');
          await markDone(parts[1]);
          setLines(prev=>prev.concat('todo marked done.'));
          return;
        }
        setLines(prev=>prev.concat('usage: /todos [list|scan|done <id>]'));
        return;
      }
      if (text.startsWith('/statusline')) {
        const parts = text.split(/\s+/).slice(1);
        if (!parts.length || parts[0] === 'show') {
          setLines(prev=>prev.concat(`statusline: ${cfg?.statusline?.format || 'plato | {provider} | {model} | {tokens} {branch}'}`));
          return;
        }
        if (parts[0] === 'set') {
          const fmt = parts.slice(1).join(' ');
          if (!fmt) { setLines(prev=>prev.concat('usage: /statusline set <format with {placeholders}>')); return; }
          await setConfigValue('statusline', JSON.stringify({ format: fmt }));
          setCfg(await loadConfig());
          setLines(prev=>prev.concat('statusline updated.'));
          return;
        }
        setLines(prev=>prev.concat('usage: /statusline [show|set <format>]'));
        return;
      }
      if (text === '/resume') {
        try {
          await orchestrator.importJSON('.plato/session.json');
          setLines(prev=>prev.concat('session restored from .plato/session.json'));
        } catch (e: any) {
          setLines(prev=>prev.concat(`error: ${e?.message || e}`));
        }
        return;
      }
      if (text.startsWith('/context')) {
        const { listCandidates, getSelected, addToSelected, removeFromSelected, tokenEstimateForFiles } = await import('../context/context.js');
        const parts = text.split(/\s+/).slice(1);
        if (!parts.length || parts[0] === 'show') {
          const sel = await getSelected();
          const est = await tokenEstimateForFiles(sel);
          setLines(prev=>prev.concat(`selected: ${sel.length} files ~${est.tokens} tokens`, ...sel.slice(0,20).map(p=>` - ${p}`)));
        } else if (parts[0] === 'add') {
          const globs = parts.slice(1);
          const cands = await listCandidates(globs);
          const sel = await addToSelected(cands);
          setLines(prev=>prev.concat(`added ${cands.length} files. total ${sel.length}.`));
        } else if (parts[0] === 'remove') {
          const globs = parts.slice(1);
          const cands = await listCandidates(globs);
          const sel = await removeFromSelected(cands);
          setLines(prev=>prev.concat(`removed ${cands.length} files. total ${sel.length}.`));
        } else {
          setLines(prev=>prev.concat('usage: /context [show|add <glob..>|remove <glob..>]'));
        }
      }
      if (text === '/cost') {
        const { orchestrator } = await import('../runtime/orchestrator.js');
        const m = orchestrator.getMetrics();
        setLines(prev=>prev.concat(`tokens in=${m.inputTokens} out=${m.outputTokens} | duration=${m.durationMs}ms | turns=${m.turns}`));
        return;
      }
      if (text.startsWith('/export')) {
        const parts = text.split(/\s+/).slice(1);
        const mode = parts[0]?.startsWith('--') ? parts[0].slice(2) : 'md';
        const file = parts.find(p=>!p.startsWith('--')) || (mode==='json' ? 'plato-session.json' : 'plato-session.md');
        const { orchestrator } = await import('../runtime/orchestrator.js');
        if (mode === 'json') await orchestrator.exportJSON(file); else await orchestrator.exportMarkdown(file);
        setLines(prev=>prev.concat(`exported ${mode.toUpperCase()} -> ${file}`));
        return;
      }
      if (text === '/doctor') {
        const { runDoctor } = await import('../ops/doctor.js');
        const lines = await runDoctor();
        setLines(prev=>prev.concat('doctor:', ...lines.map(l=>' - '+l)));
      }
      if (text.startsWith('/mcp')) {
        const parts = text.split(/\s+/).slice(1);
        const { listServers, attachServer, detachServer, health, listTools, callTool } = await import('../integrations/mcp.js');
        if (!parts.length || parts[0] === 'list') {
          const list = await listServers();
          setLines(prev=>prev.concat('mcp servers:', ...list.map(s=>` - ${s.id} ${s.url}`)));
          return;
        }
        if (parts[0] === 'attach' && parts[1] && parts[2]) { await attachServer(parts[1], parts[2]); setLines(prev=>prev.concat('attached.')); return; }
        if (parts[0] === 'detach' && parts[1]) { await detachServer(parts[1]); setLines(prev=>prev.concat('detached.')); return; }
        if (parts[0] === 'health') { const res = await health(parts[1]); setLines(prev=>prev.concat('health:', ...res.map(r=>` - ${r.id}: ${r.ok?'ok':'down'} (${r.status||'n/a'})`))); return; }
        if (parts[0] === 'tools') { const res = await listTools(parts[1]); setLines(prev=>prev.concat('tools:', ...res.flatMap(r=>r.tools.map(t=>` - [${r.server}] ${t.name} ${t.description||''}`)))); return; }
        if (parts[0] === 'run' && parts[1] && parts[2]) {
          try { const inputRaw = parts.slice(3).join(' ') || '{}'; const input = JSON.parse(inputRaw); const out = await callTool(parts[1], parts[2], input); setLines(prev=>prev.concat(JSON.stringify(out, null, 2))); } catch (e: any) { setLines(prev=>prev.concat(`error: ${e?.message||e}`)); }
          return;
        }
        setLines(prev=>prev.concat('usage: /mcp [list|attach <id> <url>|detach <id>|health [id]|tools [id]|run <id> <tool> <json>]'));
        return;
      }

      if (text === '/diff') {
        const p = orchestrator.getPendingPatch();
        if (!p) { setLines(prev=>prev.concat('no pending patch.')); return; }
        const preview = p.split('\n').slice(0,60);
        setLines(prev=>prev.concat('pending patch preview:', ...preview));
        return;
      }
      if (text.startsWith('/apply')) {
        const p = orchestrator.getPendingPatch();
        if (!p) { setLines(prev=>prev.concat('no pending patch to apply.')); return; }
        const { reviewPatch } = await import('../policies/security.js');
        const issues = reviewPatch(p);
        const high = issues.find(i=>i.severity==='high');
        if (high) { setLines(prev=>prev.concat('security-review failed (high):', ...issues.map(i=>` - [${i.severity}] ${i.message}`))); return; }
        const { dryRunApply, apply } = await import('../tools/patch.js');
        const dry = await dryRunApply(p);
        if (!dry.ok) { setLines(prev=>prev.concat('apply check failed:', ...dry.conflicts.slice(0,20))); return; }
        const { runHooks } = await import('../tools/hooks.js');
        const { checkPermission } = await import('../tools/permissions.js');
        const decision = await checkPermission({ tool: 'fs_patch', path: '*' });
        if (decision === 'deny') { setLines(prev=>prev.concat('fs_patch denied by permissions.')); return; }
        if (decision === 'confirm') {
          setConfirm({ question: 'Apply pending patch?', proceed: async () => { await runHooks('on-apply','before'); await apply(p); await runHooks('on-apply','after'); orchestrator.clearPendingPatch(); setLines(prev=>prev.concat('patch applied.')); } });
          setLines(prev=>prev.concat('confirm: apply pending patch? (y/n)'));
        } else {
          await runHooks('on-apply','before');
          await apply(p);
          await runHooks('on-apply','after');
          orchestrator.clearPendingPatch();
          setLines(prev=>prev.concat('patch applied.'));
        }
        return;
      }
      if (text.startsWith('/revert')) {
        const { revertLast } = await import('../tools/patch.js');
        const ok = await revertLast();
        setLines(prev=>prev.concat(ok ? 'reverted last patch.' : 'nothing to revert.'));
        return;
      }
      if (text.startsWith('/permissions')) {
        const { loadPermissions, checkPermission, setDefault, addPermissionRule, removePermissionRule } = await import('../tools/permissions.js');
        const parts = text.split(/\s+/);
        if (!parts[1] || parts[1] === 'list') {
          const cfgp = await loadPermissions();
          const rules = cfgp.rules || [];
          const linesOut = [ `defaults: ${JSON.stringify(cfgp.defaults||{})}`, 'rules:' ].concat(rules.map((r,i)=>` ${i}. tool=${r.match.tool||'*'} path=${r.match.path||''} cmd=${r.match.command||''} => ${r.action}`));
          setLines(prev=>prev.concat('permissions:', ...linesOut));
          return;
        }
        if (parts[1] === 'default' && parts[2] && parts[3]) {
          await setDefault(parts[2], parts[3] as any);
          setLines(prev=>prev.concat('default set.'));
          return;
        }
        if (parts[1] === 'add' && parts[2] && parts[3]) {
          const tool = parts[2];
          const action = parts[3] as any;
          let pathGlob = '';
          let cmdRe = '';
          const iPath = parts.indexOf('--path');
          if (iPath >= 0) pathGlob = parts[iPath+1];
          const iCmd = parts.indexOf('--command');
          if (iCmd >= 0) cmdRe = parts[iCmd+1];
          await addPermissionRule({ match: { tool, path: pathGlob || undefined, command: cmdRe || undefined }, action });
          setLines(prev=>prev.concat('rule added.'));
          return;
        }
        if (parts[1] === 'rm' && parts[2]) {
          const idx = Number(parts[2]);
          await removePermissionRule(idx);
          setLines(prev=>prev.concat('rule removed.'));
          return;
        }
        if (parts[1]==='test' && parts[2]) {
          const tool = parts[2];
          const cmd = parts.slice(3).join(' ');
          const res = await checkPermission({ tool, command: cmd });
          setLines(prev=>prev.concat(`test: tool=${tool} => ${res}`));
          return;
        }
        setLines(prev=>prev.concat('usage: /permissions [list|default <tool> <allow|deny|confirm>|add <tool> <allow|deny|confirm> [--path <glob>] [--command <regex>]|rm <index>|test <tool> <args...>]'));
        return;
      }
      if (text.startsWith('/run ')) {
        const cmd = text.slice(5);
        const { checkPermission } = await import('../tools/permissions.js');
        const decision = await checkPermission({ tool: 'exec', command: cmd });
        if (decision === 'deny') { setLines(prev=>prev.concat('exec denied by permissions.')); return; }
        const execAction = async () => {
          const { execa } = await import('execa');
          try {
            const child = execa(process.env.SHELL || 'bash', ['-lc', cmd]);
            child.stdout?.on('data', (d)=> setLines(prev=>prev.concat(String(d).trimEnd())));
            child.stderr?.on('data', (d)=> setLines(prev=>prev.concat(String(d).trimEnd())));
            const res = await child;
            setLines(prev=>prev.concat(`exit ${res.exitCode}`));
          } catch (e: any) {
            setLines(prev=>prev.concat(`error: ${e?.message || e}`));
          }
        };
        if (decision === 'confirm') {
          setConfirm({ question: `Run: ${cmd}?`, proceed: execAction });
          setLines(prev=>prev.concat(`confirm: run '${cmd}'? (y/n)`));
        } else {
          await execAction();
        }
        return;
      }
      return;
    }
    setLines(prev => prev.concat(`You: ${text}`));
    setStatus('Thinking...');
    let acc = '';
    try {
      await orchestrator.respondStream(text, (delta) => {
        acc += delta;
        // show last assistant line streaming
        setLines(prev => {
          const copy = prev.slice();
          // ensure streaming line exists
          if (!copy.length || !copy[copy.length-1].startsWith('Plato: ')) copy.push('Plato: ');
          copy[copy.length-1] = 'Plato: ' + acc;
          return copy;
        });
      }, (evt) => {
        if (evt.type === 'info') setLines(prev=>prev.concat(`info: ${evt.message}`));
        if (evt.type === 'tool-start') setLines(prev=>prev.concat(`tool: ${evt.message}`));
        if (evt.type === 'tool-end') setLines(prev=>prev.concat('tool: done'));
      });
    } catch (e: any) {
      setLines(prev=>prev.concat(`error: ${e?.message || e}`));
    } finally {
      setStatus('');
    }
  }

  return (
    <Box flexDirection="column" width={process.stdout.columns} height={process.stdout.rows}>
      <Box borderStyle="round" borderColor="blue" padding={1} flexDirection="column" height={process.stdout.rows-3}>
        {lines.slice(-Math.max(1, process.stdout.rows-6)).map((l, i) => (<Text key={i}>{l}</Text>))}
      </Box>
      <Box>
        <Text color="gray">{confirm ? `CONFIRM: ${confirm.question} (y/n)` : (status || statusline)}</Text>
      </Box>
      <Box>
        <Text>{'> '}{input}</Text>
      </Box>
    </Box>
  );
}
