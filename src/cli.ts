import { runTui } from './tui/app.js';
import { ensureConfigLoaded, loadConfig, setConfigValue } from './config.js';
import { loginCopilot, logoutCopilot } from './providers/copilot.js';
import { print } from './util/print.js';

async function main() {
  const [,, cmd, ...rest] = process.argv;
  if (!cmd) {
    await ensureConfigLoaded();
    await runTui();
    return;
  }
  switch (cmd) {
    case 'login': {
      await loginCopilot();
      break;
    }
    case 'logout': {
      await logoutCopilot();
      break;
    }
    case 'config': {
      const sub = rest[0];
      if (sub === 'get') {
        const key = rest[1];
        const cfg = await loadConfig();
        print(JSON.stringify(key ? cfg?.[key as keyof typeof cfg] : cfg, null, 2));
      } else if (sub === 'set') {
        const key = rest[1];
        const value = rest[2];
        if (!key || value === undefined) throw new Error('Usage: plato config set <key> <value>');
        await setConfigValue(key, value);
        print('OK');
      } else {
        print('Usage: plato config get|set ...');
      }
      break;
    }
    case 'index': {
      const { buildIndex } = await import('./context/indexer.js');
      await buildIndex({ roots: [process.cwd()] });
      print('Indexed');
      break;
    }
    default: {
      print(`Unknown command: ${cmd}`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});

