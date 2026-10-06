import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

export function canListen(port, host) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolve(false);
      else reject(error);
    });
    probe.listen(port, host, () => probe.close(() => resolve(true)));
  });
}

export async function waitForAvailablePort(port, host, { signal, log = console.log, intervalMs = 1000 } = {}) {
  let announced = false;
  while (!signal?.aborted) {
    if (await canListen(port, host)) return;
    if (!announced) {
      log(`[QMAH] 前台 ${host}:${port} 已被占用，等待釋放後自動啟動；API／管理後台可繼續執行。請關閉先前的前台終端機或偵錯工作階段。`);
      announced = true;
    }
    await setTimeout(intervalMs, undefined, { signal });
  }
  signal.throwIfAborted();
}

export function stopProcessTree(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    // Only terminate the process tree started by this launcher, never a port owner.
    const result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    if (result.error) throw result.error;
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}
