import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let server: Awaited<ReturnType<typeof createServer>>;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
});
after(async () => {
  await server?.close();
});

test(
  'community pages render for every member and keep requests/registrations private',
  { timeout: 60000 },
  async () => {
    const { checkCommunityRendering } = await server.ssrLoadModule(
      '/tests/community-render-harness.tsx',
    );
    assert.ok((await checkCommunityRendering()) >= 60);
  },
);

test(
  'account, role, benefits and CMS pages render with scoped workspaces and restorable archives',
  { timeout: 60000 },
  async () => {
    const { checkPlatformRendering } = await server.ssrLoadModule(
      '/tests/platform-render-harness.tsx',
    );
    assert.ok((await checkPlatformRendering()) >= 45);
  },
);
