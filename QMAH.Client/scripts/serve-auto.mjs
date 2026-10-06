import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ensureDependencies } from './ensure-dependencies.mjs';
import { canListen, stopProcessTree, waitForAvailablePort } from './dev-server-lifecycle.mjs';

const host = process.env.QMAH_API_HOST ?? 'localhost';
const args = process.argv.slice(2);
const protocolIndex = args.indexOf('--api-protocol');
const forcedProtocol = (protocolIndex >= 0 ? args.splice(protocolIndex, 2)[1] : process.env.QMAH_API_PROTOCOL)?.toLowerCase();
if (protocolIndex >= 0 && !['https', 'http'].includes(forcedProtocol)) {
  throw new Error('--api-protocol 必須是 https 或 http。');
}
function option(name, fallback, alias) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.findIndex((arg) => arg === name || (alias && arg === alias));
  return index >= 0 ? args[index + 1] : fallback;
}
const port = Number(option('--port', '4200', '-p'));
const clientHost = option('--host', 'localhost');
if (!Number.isInteger(port) || port < 1 || port > 65535 || !clientHost) {
  throw new Error('請提供有效的前台 --port（1～65535）與 --host。');
}
const helpOnly = args.includes('--help') || args.includes('-h');
const candidates = [
  { protocol: 'https', port: 7249, proxy: 'proxy.conf.json' },
  { protocol: 'http', port: 5147, proxy: 'proxy.http.conf.json' },
];

function canConnect(port, timeoutMs = 350) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (available) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(available);
    };

    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function chooseProxy() {
  if (forcedProtocol) {
    const forced = candidates.find((candidate) => candidate.protocol === forcedProtocol);
    if (forced) return forced;
  }

  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    // HTTPS is preferred when both launch profiles are listening.
    for (const candidate of candidates) {
      if (await canConnect(candidate.port)) return candidate;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // Keep the normal HTTPS profile as the safe fallback when the API is not ready yet.
  return candidates[0];
}

const controller = new AbortController();
let child;
const stop = () => {
  controller.abort();
  stopProcessTree(child);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
process.once('exit', () => stopProcessTree(child));

try {
  while (!controller.signal.aborted) {
    if (!helpOnly) await waitForAvailablePort(port, clientHost, { signal: controller.signal });
    if (controller.signal.aborted) break;
    // Wait before installing so a second launcher cannot replace a running server's dependencies.
    await ensureDependencies(process.cwd());
    if (controller.signal.aborted) break;
    const selected = await chooseProxy();
    if (controller.signal.aborted) break;
    console.log(`[QMAH] Angular proxy: ${selected.protocol} API (${host}:${selected.port})`);

    const ngEntry = path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
    child = spawn(process.execPath, [ngEntry, 'serve', '--proxy-config', selected.proxy, ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    });
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (exitCode, signal) => resolve(exitCode ?? (signal ? 1 : 0)));
    });
    child = undefined;
    if (controller.signal.aborted) break;
    // Another launcher can win the port between the probe and ng serve; wait and retry.
    if (!helpOnly && code !== 0 && !(await canListen(port, clientHost))) continue;
    process.exitCode = code;
    break;
  }
} catch (error) {
  if (!controller.signal.aborted) {
    console.error(`[QMAH] 無法啟動 Angular：${error.message}`);
    process.exitCode = 1;
  }
} finally {
  stopProcessTree(child);
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
