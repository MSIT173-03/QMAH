import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node 25+ host Web Storage shadows jsdom's browser Storage. Keep the
    // browser implementation available to every test; no tests are excluded.
    // https://github.com/vitest-dev/vitest/issues/10867
    execArgv: Number(process.versions.node.split('.')[0]) >= 25
      ? ['--no-experimental-webstorage']
      : [],
  },
});
