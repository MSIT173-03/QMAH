import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { setTimeout } from 'node:timers/promises';
import test from 'node:test';
import { canListen, stopProcessTree, waitForAvailablePort } from './dev-server-lifecycle.mjs';

async function occupiedPort(t, host = '127.0.0.1') {
  const server = net.createServer();
  server.listen(0, host);
  await once(server, 'listening');
  t.after(() => { if (server.listening) server.close(); });
  return { server, port: server.address().port, host };
}

test('occupied ports wait without throwing or launching another frontend', { timeout: 5000 }, async (t) => {
  const { server, port, host } = await occupiedPort(t);
  assert.equal(await canListen(port, host), false);
  const messages = [];
  let ready = false;
  const waiting = waitForAvailablePort(port, host, { intervalMs: 10, log: (message) => messages.push(message) })
    .then(() => { ready = true; });
  await setTimeout(60);
  assert.equal(ready, false);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /API／管理後台可繼續執行/);
  await new Promise((resolve) => server.close(resolve));
  await waiting;
  assert.equal(ready, true);
});

test('stopping a launcher while it waits releases the wait', { timeout: 5000 }, async (t) => {
  const { port, host } = await occupiedPort(t);
  const controller = new AbortController();
  const waiting = waitForAvailablePort(port, host, { signal: controller.signal, intervalMs: 10, log: () => {} });
  const rejected = assert.rejects(waiting, { name: 'AbortError' });
  await setTimeout(30);
  controller.abort();
  await rejected;
});

test('the localhost IPv6 port used by Angular is detected', { timeout: 5000 }, async (t) => {
  const { port } = await occupiedPort(t, '::1');
  assert.equal(await canListen(port, '::1'), false);
  assert.equal(await canListen(port, 'localhost'), false);
});

test('stopping the owned frontend also stops its worker, preserving unrelated listeners', { timeout: 10000 }, async (t) => {
  const unrelated = await occupiedPort(t);
  const workerSource = `
    require('node:net').createServer().listen(0, '127.0.0.1', function () {
      console.log('worker:' + this.address().port);
    });
  `;
  const source = `
    require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(workerSource)}], { stdio: 'inherit' });
    require('node:net').createServer().listen(0, '127.0.0.1', function () {
      console.log('parent:' + this.address().port);
    });
  `;
  const child = spawn(process.execPath, ['-e', source], {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => stopProcessTree(child));
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  const deadline = Date.now() + 5000;
  while ((!/parent:\d+/.test(output) || !/worker:\d+/.test(output)) && Date.now() < deadline) await setTimeout(20);
  assert.match(output, /parent:\d+/);
  assert.match(output, /worker:\d+/);
  const ports = [...output.matchAll(/(?:parent|worker):(\d+)/g)].map((match) => Number(match[1]));
  const exited = once(child, 'exit');
  stopProcessTree(child);
  await exited;
  for (const port of ports) {
    let available = false;
    const releaseDeadline = Date.now() + 2000;
    while (!available && Date.now() < releaseDeadline) {
      available = await canListen(port, '127.0.0.1');
      if (!available) await setTimeout(20);
    }
    assert.equal(available, true);
  }
  assert.equal(await canListen(unrelated.port, unrelated.host), false);
});
