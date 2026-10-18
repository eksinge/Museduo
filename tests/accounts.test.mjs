import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { identity, parseInvocation } from '../scripts/muse.mjs';
import { createAccount, selectAccount, selectedAccount, listAccounts, renameAccount, resolveAccount, withAccountLock } from '../scripts/accounts.mjs';

const scratch = resolve('..', '..', 'work', 'account-unit');
mkdirSync(scratch, { recursive: true });
function fixture() {
  const base = mkdtempSync(join(scratch, 'case-'));
  const a = identity({ CODEX_THREAD_ID: 'test-chat-a', MUSE_CHAT_DATA_DIR: base });
  const b = identity({ CODEX_THREAD_ID: 'test-chat-b', MUSE_CHAT_DATA_DIR: base });
  return { a, b, base };
}
function registerLegacy(caller) {
  mkdirSync(caller.profile, { recursive: true });
  writeFileSync(join(caller.directory, 'binding.json'), JSON.stringify({ threadId: caller.threadId, session: caller.session, profile: caller.profile }));
}
test('one conversation can create independent persistent accounts without changing its identity', () => {
  const { a } = fixture();
  const first = createAccount(a, '账号 A');
  const second = createAccount(a, '账号 B');
  assert.notEqual(first.profile, second.profile);
  assert.notEqual(first.session, second.session);
  assert.equal(selectedAccount(a).accountId, second.accountId);
  assert.equal(selectAccount(a, '账号 A').profile, first.profile);
  assert.equal(selectedAccount({ ...a }).profile, first.profile);
  assert.equal(a.threadId, 'test-chat-a');
});
test('a second conversation can select an account without changing the owner or its selection', () => {
  const { a, b } = fixture();
  const first = createAccount(a, 'A');
  const second = createAccount(a, 'B');
  assert.equal(selectAccount(b, first.accountId.slice(0, 12)).profile, first.profile);
  assert.equal(selectedAccount(a).accountId, second.accountId);
  assert.equal(selectedAccount(b).threadId, a.threadId);
  assert.equal(selectedAccount(a, first.accountId).profile, first.profile);
  assert.equal(selectedAccount(a).accountId, second.accountId, 'per-command selector does not change sticky selection');
});
test('legacy open accounts are discovered automatically with original session, profile and binding', () => {
  const { a, b } = fixture();
  registerLegacy(b);
  const before = readFileSync(join(b.directory, 'binding.json'), 'utf8');
  const account = selectAccount(a, b.key);
  assert.equal(account.profile, b.profile);
  assert.equal(account.session, b.session);
  assert.equal(account.threadId, b.threadId);
  renameAccount(a, b.key, '旧账号');
  assert.equal(resolveAccount(a, '旧账号').profile, b.profile);
  assert.equal(readFileSync(join(b.directory, 'binding.json'), 'utf8'), before);
});
test('Codex and Claude default profiles stay distinct while explicit account sharing is allowed', () => {
  const { a, base } = fixture();
  const claude = identity({ MUSE_CHAT_DATA_DIR: base }, a.threadId);
  registerLegacy(a);
  registerLegacy(claude);
  assert.notEqual(selectedAccount(a).profile, selectedAccount(claude).profile);
  assert.equal(selectAccount(a, claude.key).profile, claude.profile);
  assert.equal(listAccounts(a).find(x => x.key === claude.key).host, 'claude');
});
test('duplicate names and unknown IDs cannot silently choose another account', () => {
  const { a } = fixture();
  createAccount(a, 'duplicate');
  createAccount(a, 'duplicate');
  assert.throws(() => selectAccount(a, 'duplicate'), /不唯一/);
  for (const bad of ['missing', '../profile', '123', '']) assert.throws(() => selectAccount(a, bad));
  for (const bad of ['', '   ', '\nname', 'a'.repeat(81)]) assert.throws(() => createAccount(a, bad));
});
test('new names never become filesystem paths and corrupt selected state fails closed', () => {
  const { a } = fixture();
  const account = createAccount(a, '../账号');
  assert.match(account.accountId, /^[a-f0-9]{64}$/);
  assert.equal(account.directory, join(a.base, 'accounts', account.accountId));
  writeFileSync(join(a.directory, 'selected-account.json'), '{broken');
  assert.throws(() => selectedAccount(a));
});
test('cannot import a binding for an arbitrary account directory or path', () => {
  const { a, b } = fixture();
  registerLegacy(b);
  writeFileSync(join(b.directory, 'binding.json'), JSON.stringify({ threadId: 'different-thread', profile: 'C:/arbitrary' }));
  assert.throws(() => listAccounts(a), /不符/);
});
test('same-account commands from two conversations cannot overlap, lock is released on failure', async () => {
  const { a, b } = fixture();
  const account = createAccount(a, 'lock');
  await withAccountLock(account, a, async () => {
    await assert.rejects(withAccountLock(account, b, () => assert.fail('must not run')), /占用/);
  });
  await assert.rejects(withAccountLock(account, b, () => { throw new Error('test failure'); }), /test failure/);
  assert.equal(existsSync(join(account.directory, 'command.lock')), false);
  await withAccountLock(account, b, () => {});
});
test('independent processes respect the same account lock while different accounts stay usable', async () => {
  const { a, b } = fixture();
  const account = createAccount(a, 'shared');
  const other = createAccount(a, 'other');
  const moduleUrl = pathToFileURL(resolve('scripts/accounts.mjs')).href;
  const code = `import {withAccountLock} from ${JSON.stringify(moduleUrl)}; await withAccountLock(${JSON.stringify(account)},${JSON.stringify(b)},async()=>{process.stdout.write('locked'); await new Promise(ok=>process.stdin.once('data',ok));});process.stdin.pause();`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    await once(child.stdout, 'data');
    await assert.rejects(withAccountLock(account, a, () => assert.fail('must not overlap')), /占用/);
    await withAccountLock(other, a, () => {});
    const exit = once(child, 'exit');
    child.stdin.end('release');
    assert.equal((await exit)[0], 0);
    await withAccountLock(account, a, () => {});
  } finally { if (child.exitCode === null) child.kill(); }
});
test('a provably dead command owner is recovered without leaving a gate or lock', async () => {
  const { a } = fixture();
  const account = createAccount(a, 'recovery');
  const ended = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8', windowsHide: true });
  assert.equal(ended.status, 0);
  writeFileSync(join(account.directory, 'command.lock'), JSON.stringify({ pid: Number(ended.stdout), token: 'old-token' }));
  await withAccountLock(account, a, () => {});
  assert.equal(existsSync(join(account.directory, 'command.lock')), false);
  assert.equal(existsSync(join(account.directory, 'command-gate')), false);
});
test('explicit account selector and Claude identity work in either prefix order', () => {
  const expected = { claudeSessionId: 'test', command: 'open', commandArgs: [], accountSelector: '账号 A' };
  assert.deepEqual(parseInvocation(['--account', '账号 A', '--claude-session-id', 'test', '1']), expected);
  assert.deepEqual(parseInvocation(['--claude-session-id', 'test', '--account', '账号 A', '1']), expected);
  for (const args of [['--account'], ['--account', '--headless'], ['--account', 'A', '--account', 'B']]) assert.throws(() => parseInvocation(args));
  assert.deepEqual(parseInvocation(['fill', 'e1', '--account']), { claudeSessionId: undefined, command: 'fill', commandArgs: ['e1', '--account'] });
});
