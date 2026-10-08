import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function ensureDependencies(clientRoot, npmCli = process.env.npm_execpath) {
  const manifest = await readJson(path.join(clientRoot, 'package.json'));
  const lock = await readJson(path.join(clientRoot, 'package-lock.json'));
  const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });

  async function findMissingOrOutdated() {
    const pending = [];
    for (const name of dependencies) {
      const expected = lock.packages?.[`node_modules/${name}`]?.version;
      if (!expected) {
        throw new Error(`package-lock.json 缺少 ${name}，請執行 npm install 並提交更新的鎖定檔。`);
      }
      let installed;
      try {
        installed = await readJson(path.join(clientRoot, 'node_modules', name, 'package.json'));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (installed?.version !== expected) pending.push(name);
    }
    return pending;
  }

  const pending = await findMissingOrOutdated();
  if (pending.length === 0) return;
  if (!npmCli) throw new Error('請透過 npm start 或 npm run 執行，才能自動安裝前台套件。');

  console.log(`[QMAH] 套件缺少或版本過舊：${pending.join(', ')}。自動執行 npm ci…`);
  // Invoke npm through Node so Windows does not need a shell to execute npm.cmd.
  const result = spawnSync(process.execPath, [npmCli, 'ci', '--include=dev', '--no-audit', '--no-fund'], {
    cwd: clientRoot,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`前台套件安裝失敗（${result.signal ?? result.status}），停止啟動；請確認 npm 錯誤後重試。`);
  }
  const remaining = await findMissingOrOutdated();
  if (remaining.length > 0) throw new Error(`套件安裝後仍缺少或版本不符：${remaining.join(', ')}。`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const clientRoot = fileURLToPath(new URL('../', import.meta.url));
  try {
    await ensureDependencies(clientRoot);
  } catch (error) {
    console.error(`[QMAH] ${error.message}`);
    process.exitCode = 1;
  }
}
