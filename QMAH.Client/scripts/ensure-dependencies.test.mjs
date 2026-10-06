import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ensureDependencies } from './ensure-dependencies.mjs';

async function fixture(t, installedVersion) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qmah-dependencies-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = { dependencies: { '@microsoft/signalr': '^10.0.11' } };
  const lock = { packages: { 'node_modules/@microsoft/signalr': { version: '10.0.11' } } };
  await writeFile(path.join(root, 'package.json'), JSON.stringify(manifest));
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify(lock));
  if (installedVersion) {
    const destination = path.join(root, 'node_modules', '@microsoft', 'signalr');
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, 'package.json'), JSON.stringify({ version: installedVersion }));
  }
  const npmCli = path.join(root, 'npm-fixture.mjs');
  await writeFile(npmCli, `
    import { mkdirSync, writeFileSync } from 'node:fs';
    writeFileSync('npm-args.json', JSON.stringify(process.argv.slice(2)));
    mkdirSync('node_modules/@microsoft/signalr', { recursive: true });
    writeFileSync('node_modules/@microsoft/signalr/package.json', JSON.stringify({ version: '10.0.11' }));
  `);
  return { root, npmCli };
}

test('matching dependencies start without invoking npm or requiring a network', async (t) => {
  const { root } = await fixture(t, '10.0.11');
  await ensureDependencies(root, undefined);
  await assert.rejects(readFile(path.join(root, 'npm-args.json')), { code: 'ENOENT' });
});

for (const installedVersion of [undefined, '10.0.10']) {
  test(`${installedVersion ? 'outdated' : 'missing'} SignalR installs locked dependencies before continuing`, async (t) => {
    const { root, npmCli } = await fixture(t, installedVersion);
    const originalLock = await readFile(path.join(root, 'package-lock.json'), 'utf8');
    await ensureDependencies(root, npmCli);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, 'npm-args.json'), 'utf8')),
      ['ci', '--include=dev', '--no-audit', '--no-fund']);
    assert.equal(await readFile(path.join(root, 'package-lock.json'), 'utf8'), originalLock);
  });
}

test('missing development dependencies also trigger installation', async (t) => {
  const { root, npmCli } = await fixture(t);
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { '@microsoft/signalr': '^10.0.11' } }));
  await ensureDependencies(root, npmCli);
  assert.equal(JSON.parse(await readFile(path.join(root, 'node_modules/@microsoft/signalr/package.json'), 'utf8')).version, '10.0.11');
});

test('failed installation blocks startup', async (t) => {
  const { root, npmCli } = await fixture(t);
  await writeFile(npmCli, 'process.exit(7);');
  await assert.rejects(ensureDependencies(root, npmCli), /安裝失敗（7）/);
});

test('a successful installer that leaves dependencies missing still blocks startup', async (t) => {
  const { root, npmCli } = await fixture(t);
  await writeFile(npmCli, 'process.exit(0);');
  await assert.rejects(ensureDependencies(root, npmCli), /安裝後仍缺少或版本不符/);
});

test('an incomplete lockfile fails without installing unpinned packages', async (t) => {
  const { root, npmCli } = await fixture(t);
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ packages: {} }));
  await assert.rejects(ensureDependencies(root, npmCli), /package-lock.json 缺少 @microsoft\/signalr/);
  await assert.rejects(readFile(path.join(root, 'npm-args.json')), { code: 'ENOENT' });
});
