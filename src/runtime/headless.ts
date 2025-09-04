import { orchestrator } from './orchestrator.js';
import { loadConfig, setConfigValue } from '../config.js';
import { ensureConfigLoaded } from '../config.js';

export interface HeadlessOptions {
  skipPermissions: boolean;
  outputFormat: 'text' | 'stream-json';
  directOutput: boolean;
}

export async function runHeadless(prompt: string, options: HeadlessOptions): Promise<void> {
  await ensureConfigLoaded();
  
  // Configure permissions if skip flag is set
  if (options.skipPermissions) {
    await configurePermissionSkip();
  }

  // Set up output handling
  const outputHandler = createOutputHandler(options);
  
  try {
    if (options.outputFormat === 'stream-json') {
      await runStreamingJSON(prompt, outputHandler);
    } else {
      await runTextMode(prompt, outputHandler, options.directOutput);
    }
  } catch (error: any) {
    if (options.outputFormat === 'stream-json') {
      outputHandler({
        type: 'error',
        timestamp: new Date().toISOString(),
        content: error?.message || 'Unknown error'
      });
    } else {
      console.error(`Error: ${error?.message || error}`);
      process.exit(1);
    }
  }
}

async function configurePermissionSkip(): Promise<void> {
  // Temporarily configure to skip permissions
  const config = await loadConfig();
  
  // Store original settings if we need to restore them
  const originalSettings = {
    privacy: config.privacy
  };
  
  // Set dangerous skip mode - this bypasses all permission checks
  // Note: This is implemented as a configuration override
  process.env.PLATO_SKIP_PERMISSIONS = 'true';
  
  // Also update runtime config to disable permission prompts
  await setConfigValue('privacy', JSON.stringify({
    ...config.privacy,
    skip_all_prompts: true,
    dangerous_mode: true
  }));
}

function createOutputHandler(options: HeadlessOptions): (data: any) => void {
  if (options.outputFormat === 'stream-json') {
    return (data) => {
      const jsonLine = typeof data === 'string' 
        ? { type: 'content', timestamp: new Date().toISOString(), content: data }
        : data;
      console.log(JSON.stringify(jsonLine));
    };
  } else {
    return (data) => {
      const content = typeof data === 'string' ? data : data.content || JSON.stringify(data);
      if (options.directOutput) {
        console.log(content);
      } else {
        process.stdout.write(content);
      }
    };
  }
}

async function runStreamingJSON(prompt: string, outputHandler: (data: any) => void): Promise<void> {
  // Start streaming JSON output
  outputHandler({
    type: 'start',
    timestamp: new Date().toISOString(),
    prompt: prompt
  });

  let accumulatedResponse = '';
  
  await orchestrator.respondStream(
    prompt,
    (delta: string) => {
      accumulatedResponse += delta;
      outputHandler({
        type: 'delta',
        timestamp: new Date().toISOString(),
        content: delta
      });
    },
    (event) => {
      outputHandler({
        type: 'event',
        timestamp: new Date().toISOString(),
        event_type: event.type,
        message: event.message
      });
    }
  );

  // End streaming
  outputHandler({
    type: 'complete',
    timestamp: new Date().toISOString(),
    full_response: accumulatedResponse,
    metrics: orchestrator.getMetrics()
  });
}

async function runTextMode(prompt: string, outputHandler: (data: any) => void, directOutput: boolean): Promise<void> {
  if (directOutput) {
    // Direct output mode - stream directly to stdout
    await orchestrator.respondStream(
      prompt,
      (delta: string) => {
        process.stdout.write(delta);
      },
      (event) => {
        // For direct output, show info events as comments
        if (event.type === 'info') {
          console.log(`# ${event.message}`);
        }
      }
    );
  } else {
    // Buffered text mode
    const response = await orchestrator.respond(
      prompt,
      (event) => {
        // Show tool and info events
        if (event.type === 'info' || event.type === 'tool-start' || event.type === 'tool-end') {
          console.error(`[${event.type}] ${event.message}`);
        }
      }
    );
    
    outputHandler(response);
  }
}