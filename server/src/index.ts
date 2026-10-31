/** Entry point: wires the real SDK and socket addresses into the app and listens. */
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { sdkGenerate } from './ai/gemini.ts';
import { createApp, usesGemini } from './app.ts';
import { loadConfig, loadLocalEnv } from './config.ts';

loadLocalEnv(resolve(import.meta.dirname, '../.env'));
const config = loadConfig(process.env);

const generate = config.geminiApiKey === undefined ? null : sdkGenerate(config.geminiApiKey);
const app = createApp({
  config,
  generate,
  socketAddress: (c) => getConnInfo(c).remote.address,
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  const genai = usesGemini(config, generate) ? 'gemini' : 'fallback';
  console.log(JSON.stringify({ event: 'listening', port: info.port, genai }));
});

function shutdown(): void {
  server.close(() => process.exit(0));
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
