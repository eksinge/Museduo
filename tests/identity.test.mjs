import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, browserArgs, cleanEnv, DEFAULT_URL, dependencyKey } from '../scripts/muse.mjs';

test('two chats in one workspace have distinct persistent profiles and session names', () => {
  const a = identity({ CODEX_THREAD_ID: 'chat-a', LOCALAPPDATA: 'C:/local' });
  const b = identity({ CODEX_THREAD_ID: 'chat-b', LOCALAPPDATA: 'C:/local' });
  assert.notEqual(a.profile, b.profile);
  assert.notEqual(a.session, b.session);
  assert.deepEqual(a, identity({ CODEX_THREAD_ID: 'chat-a', LOCALAPPDATA: 'C:/local', PWD: 'different-worktree' }));
});
test('missing or path-injecting identity fails closed', () => {
  for (const id of ['', '../other-profile', 'a/b', 'a\\b']) assert.throws(() => identity({ CODEX_THREAD_ID: id }));
});
test('host thread ID wins over session fallback', () => {
  assert.equal(identity({ CODEX_THREAD_ID: 'thread', CODEX_SESSION_ID: 'session' }).threadId, 'thread');
  assert.equal(identity({ CODEX_SESSION_ID: 'legacy' }).threadId, 'legacy');
});
test('global/destructive/attach commands and profile overrides are rejected', () => {
  const id = identity({ CODEX_THREAD_ID: 'chat' });
  for (const cmd of ['close-all', 'kill-all', 'attach', 'delete-data', 'show', 'state-load']) assert.throws(() => browserArgs(cmd, [], id, 'config'));
  for (const arg of ['-s=other', '--session=other', '--profile=other', '--config=other', '--cdp=http://other', '--browser=msedge']) assert.throws(() => browserArgs('open', [arg], id, 'config'));
});
test('open pins persistent profile; default is visible', () => {
  const id = identity({ CODEX_THREAD_ID: 'chat' });
  const args = browserArgs('open', [], id, 'config');
  assert.ok(args.includes('--headed'));
  assert.equal(DEFAULT_URL, 'https://muse.ai/');
  assert.ok(args.includes(DEFAULT_URL));
  assert.ok(args.includes(`--profile=${id.profile}`));
  assert.ok(args.includes('--persistent'));
  assert.ok(!browserArgs('open', ['about:blank', '--headless'], id, 'config').includes('--headed'));
});
test('upstream environment cannot silently redirect the browser', () => {
  assert.deepEqual(cleanEnv({ PATH: 'ok', CODEX_THREAD_ID: 'chat', PLAYWRIGHT_MCP_CDP_ENDPOINT: 'other', PLAYWRIGHT_CLI_SESSION: 'shared', PW_TEST_X: 'bad' }), { PATH: 'ok', CODEX_THREAD_ID: 'chat' });
});
test('plugin updates keep the daemon runtime stable while dependency changes use a new runtime', () => {
  const a = { version: '0.1.0', packages: { '': { version: '0.1.0' }, 'node_modules/@playwright/cli': { version: '0.1.22' } } };
  const b = { version: '0.1.2', packages: { '': { version: '0.1.2' }, 'node_modules/@playwright/cli': { version: '0.1.22' } } };
  assert.equal(dependencyKey(a), dependencyKey(b));
  const c = structuredClone(b);
  c.packages['node_modules/@playwright/cli'].version = '0.1.23';
  assert.notEqual(dependencyKey(a), dependencyKey(c));
});
