import { lstat, realpath, symlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const clientRoot = fileURLToPath(new URL('../', import.meta.url));
const mediaRoot = path.resolve(clientRoot, '../QMAH.Media/images/game');
const linkPath = path.join(clientRoot, '.game-assets');
const mediaPath = await realpath(mediaRoot);
let existing;
try { existing = await lstat(linkPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (existing) {
  if (!existing.isSymbolicLink() || await realpath(linkPath) !== mediaPath) {
    throw new Error('遊戲素材連結指向非預期目錄，停止以避免覆蓋。');
  }
} else {
  await symlink(mediaPath, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}
