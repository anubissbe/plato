import { runTui } from './tui/app.js';
import { ensureConfigLoaded, loadConfig, setConfigValue } from './config.js';
import { loginCopilot, logoutCopilot } from './providers/copilot.js';
import { print } from './util/print.js';
import { runHeadless } from './runtime/headless.js';

// CLI argument interface
interface CLIArgs {
  prompt?: string;
  dangerouslySkipPermissions?: boolean;
  outputFormat?: 'text' | 'stream-json';
  print?: boolean;
  help?: boolean;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  // Handle help
  if (args.help) {
    showHelp();
    return;
  }

  // Handle headless mode with -p flag
  if (args.prompt !== undefined) {
    await runHeadlessMode(args);
    return;
  }

  // Handle legacy commands
  const [cmd, ...rest] = process.argv.slice(2);
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

function parseArgs(args: string[]): CLIArgs {
  const result: CLIArgs = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-p':
      case '--prompt':
        if (i + 1 >= args.length) {
          throw new Error('Prompt argument required for -p flag');
        }
        result.prompt = args[++i];
        break;
        
      case '--dangerously-skip-permissions':
        result.dangerouslySkipPermissions = true;
        break;
        
      case '--output-format':
        if (i + 1 >= args.length) {
          throw new Error('Output format required for --output-format flag');
        }
        const format = args[++i];
        if (format !== 'text' && format !== 'stream-json') {
          throw new Error('Invalid output format. Use: text, stream-json');
        }
        result.outputFormat = format;
        break;
        
      case '--print':
        result.print = true;
        break;
        
      case '-h':
      case '--help':
        result.help = true;
        break;
        
      default:
        // If it's not a flag and we don't have a prompt yet, try legacy handling
        if (!arg.startsWith('-') && !result.prompt) {
          // Let legacy command handling take over
          return result;
        }
        break;
    }
  }
  
  return result;
}

async function runHeadlessMode(args: CLIArgs): Promise<void> {
  if (!args.prompt) {
    throw new Error('Prompt required for headless mode');
  }

  // Read from stdin if available
  let stdinInput = '';
  if (!process.stdin.isTTY) {
    stdinInput = await readStdin();
  }

  // Combine stdin and prompt
  const fullPrompt = stdinInput ? `${stdinInput}\n\n${args.prompt}` : args.prompt;

  await runHeadless(fullPrompt, {
    skipPermissions: args.dangerouslySkipPermissions || false,
    outputFormat: args.outputFormat || 'text',
    directOutput: args.print || false
  });
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      const chunk = process.stdin.read();
      if (chunk !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
    
    // Timeout for non-piped input
    setTimeout(() => resolve(data.trim()), 100);
  });
}

function showHelp(): void {
  const help = `
Plato - AI Coding Assistant

Usage:
  plato                                 Start interactive TUI mode
  plato -p "prompt"                     Run in headless mode with prompt
  plato [command] [args...]             Run legacy command

Headless Mode Options:
  -p, --prompt "text"                   Run prompt in headless mode
  --dangerously-skip-permissions        Skip all permission prompts
  --output-format <format>              Set output format (text, stream-json)
  --print                               Direct output mode without interactive UI

Legacy Commands:
  login                                 Login to GitHub Copilot
  logout                                Logout from GitHub Copilot
  config get [key]                      Get configuration value(s)
  config set <key> <value>              Set configuration value
  index                                 Build context index

Examples:
  plato -p "Fix all TypeScript errors"
  plato -p "Generate tests" --print --dangerously-skip-permissions
  echo "code here" | plato -p "Review this code"
  plato -p "Write docs" --output-format stream-json

Options:
  -h, --help                            Show this help message
`;
  
  console.log(help.trim());
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});

