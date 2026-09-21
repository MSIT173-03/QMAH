import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';

const host = process.env.QMAH_API_HOST ?? 'localhost';
const forcedProtocol = process.env.QMAH_API_PROTOCOL?.toLowerCase();
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

const selected = await chooseProxy();
console.log(`[QMAH] Angular proxy: ${selected.protocol} API (${host}:${selected.port})`);

const ngCommand = process.execPath;
const ngEntry = path.join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const ngArgs = [ngEntry, 'serve', '--proxy-config', selected.proxy, ...process.argv.slice(2)];
const child = spawn(ngCommand, ngArgs, {
  cwd: process.cwd(),
  stdio: 'inherit',
});

child.once('error', (error) => {
  console.error(`[QMAH] 無法啟動 Angular CLI：${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
