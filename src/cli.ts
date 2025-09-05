#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import prompts from "prompts";
import pc from "picocolors";
import { loadConfig } from "./config/index.js";
import { Session } from "./core/session.js";
import { CopilotProvider } from "./core/provider/copilot.js";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("plato")
    .usage("$0 [options] [prompt]")
    .option("print", {
      alias: "p",
      type: "boolean",
      describe: "Print response and exit",
      default: false,
    })
    .option("model", {
      type: "string",
      describe: "Model id (GitHub Models)",
      default: undefined,
    })
    .option("output-format", {
      choices: ["text", "json"] as const,
      default: "text" as const,
      describe: "Output format for --print",
    })
    .help()
    .parse();

  const cfg = loadConfig();
  if (!cfg.githubToken) {
    console.error(
      pc.red(
        "Missing GITHUB_TOKEN. Set it in your environment (requires Copilot subscription)."
      )
    );
    process.exit(1);
  }

  const provider = new CopilotProvider({ endpoint: cfg.endpoint, token: cfg.githubToken });
  const session = new Session(
    "You are a helpful coding assistant. Be concise and accurate."
  );

  const promptArg = (argv._[0] as string) || "";
  if (argv.print || promptArg) {
    const prompt = promptArg || (await askOnce());
    session.user(prompt);
    const text = await provider.chat(session.getMessages(), { model: argv.model || cfg.defaultModel });
    if (argv["output-format"] === "json") {
      process.stdout.write(JSON.stringify({ content: text }) + "\n");
    } else {
      process.stdout.write(text + "\n");
    }
    return;
  }

  console.log(pc.dim("Plato (Copilot) interactive mode. Ctrl+C to exit."));

  // REPL loop
  while (true) {
    const input = await askOnce();
    if (!input.trim()) continue;
    session.user(input);
    const spinner = startSpinner("Thinking");
    try {
      const reply = await provider.chat(session.getMessages(), { model: argv.model || cfg.defaultModel });
      stopSpinner(spinner);
      session.assistant(reply);
      console.log(pc.cyan("Assistant:"));
      console.log(reply);
    } catch (e: any) {
      stopSpinner(spinner);
      console.error(pc.red(e?.message || String(e)));
    }
  }
}

async function askOnce(): Promise<string> {
  const res = await prompts({
    type: "text",
    name: "value",
    message: pc.green("You:"),
  });
  return res.value ?? "";
}

function startSpinner(label: string) {
  const interval = setInterval(() => {
    process.stdout.write(pc.dim("."));
  }, 300);
  process.stdout.write(pc.dim(`${label}`));
  return interval;
}

function stopSpinner(interval: NodeJS.Timeout) {
  clearInterval(interval);
  process.stdout.write("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

