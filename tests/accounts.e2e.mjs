import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { install } from '../scripts/install.mjs';

const exec = promisify(execFile);
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = process.argv.includes('--mixed') ? 'mixed' : process.argv.includes('--claude') ? 'claude' : 'codex';
const installed = process.argv.includes('--installed');
const cliArgs = process.argv.slice(2);
if (cliArgs.some(arg => !['--mixed', '--claude', '--installed'].includes(arg)) || (cliArgs.includes('--mixed') && cliArgs.includes('--claude'))) throw new Error('Use [--claude | --mixed] [--installed]');
const testRoot = resolve(process.env.MUSE_TEST_ROOT || resolve(pluginRoot, '..', '..', 'work'), `accounts-${host}-${Date.now()}`);
mkdirSync(testRoot, { recursive: true });
const env = { ...process.env, MUSE_CHAT_DATA_DIR: testRoot };
const a = 'account-e2e-chat-a', b = 'account-e2e-chat-b';
const wrappers = new Map();
for (const targetHost of host === 'mixed' ? ['codex', 'claude'] : [host]) {
  let root = pluginRoot;
  if (installed) {
    // Exercise the installed copies. Registration is intentionally omitted in
    // these isolated fixtures so test installs cannot change real host settings.
    root = install({ host: targetHost, source: pluginRoot, home: join(testRoot, 'user home'), claudeConfig: join(testRoot, 'claude config'), base: testRoot, run: () => {} }).target;
  }
  wrappers.set(targetHost, join(root, 'scripts', 'muse.mjs'));
}
const server = http.createServer((req, res) => {
  const account = new URL(req.url, 'http://localhost').searchParams.get('account');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (account) res.setHeader('Set-Cookie', `account=${account}; Path=/; Max-Age=86400; SameSite=Lax`);
  res.end(`<!doctype html><title>Account manager test</title><h1>Account manager test</h1><button onclick="window.clicks=(window.clicks||0)+1">Control this account</button><script>
    window.nonce=crypto.randomUUID();
    window.ready=(async()=>{
      const incoming=${JSON.stringify(account)};
      if(incoming) localStorage.setItem('account',incoming);
      const db=await new Promise((ok,fail)=>{const r=indexedDB.open('account-test',1);r.onupgradeneeded=()=>r.result.createObjectStore('account');r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);});
      if(incoming) await new Promise((ok,fail)=>{const tx=db.transaction('account','readwrite');tx.objectStore('account').put(incoming,'current');tx.oncomplete=ok;tx.onerror=()=>fail(tx.error);});
      const indexed=await new Promise((ok,fail)=>{const r=db.transaction('account').objectStore('account').get('current');r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);});db.close();
      return {cookie:document.cookie,local:localStorage.getItem('account'),indexed:indexed??null};
    })();</script>`);
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const evidence = [];
const accounts = [];
async function cli(thread, args, cwd = pluginRoot) {
  const callerHost = host === 'mixed' ? thread === b ? 'claude' : 'codex' : host;
  const prefix = callerHost === 'claude' ? ['--claude-session-id', thread] : [];
  const wrapper = wrappers.get(callerHost);
  try {
    return (await exec(process.execPath, [wrapper, ...prefix, ...args], { env: { ...env, CODEX_THREAD_ID: thread }, cwd, windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 })).stdout;
  } catch (e) { throw new Error(`${thread}: ${args.join(' ')}\n${e.stdout || ''}\n${e.stderr || ''}`, { cause: e }); }
}
const json = async (thread, args) => JSON.parse(await cli(thread, args));
const state = async (thread, id) => json(thread, ['--account', id, 'eval', 'async () => await window.ready', '--raw']);
const want = value => ({ cookie: `account=${value}`, local: value, indexed: value });
try {
  await cli(a, ['setup']);
  const first = await json(a, ['account-new', '账号 A']);
  accounts.push(first.accountId);
  await cli(a, ['1', `${origin}/?account=ALPHA`, '--headless']);
  const second = await json(a, ['account-new', '账号 B']);
  accounts.push(second.accountId);
  await cli(a, ['1', `${origin}/view`, '--headless']);
  assert.deepEqual(await state(a, second.accountId), { cookie: '', local: null, indexed: null });
  await cli(a, ['goto', `${origin}/?account=BETA`]);
  assert.deepEqual(await state(a, first.accountId), want('ALPHA'));
  assert.deepEqual(await state(a, second.accountId), want('BETA'));
  evidence.push('One conversation opens two accounts with independent cookies, localStorage and IndexedDB.');

  // Simulate a pre-upgrade, conversation-bound account using the unchanged default.
  await cli(b, ['1', `${origin}/?account=GAMMA`, '--headless']);
  const legacy = await json(b, ['info']);
  accounts.push(legacy.accountId);
  const beforeBinding = await json(b, ['info']);
  const nonce = await json(b, ['eval', '() => window.nonce', '--raw']);
  const listing = await json(a, ['account-list']);
  assert.ok(listing.accounts.some(x => x.accountId === legacy.accountId));
  await cli(a, ['account-rename', legacy.accountId, '另一个对话的账号']);
  await cli(a, ['account-use', '另一个对话的账号']);
  const snap = await cli(a, ['snapshot']);
  const ref = snap.match(/button "Control this account" \[ref=(e\d+)\]/)?.[1];
  assert.ok(ref, `missing test button: ${snap}`);
  await cli(a, ['--account', legacy.accountId, 'click', ref]);
  assert.equal(await json(b, ['eval', '() => window.clicks', '--raw']), 1);
  assert.equal(await json(b, ['eval', '() => window.nonce', '--raw']), nonce);
  assert.deepEqual(await state(a, legacy.accountId), want('GAMMA'));
  assert.equal((await json(a, ['info'])).callerThreadId, a);
  assert.equal((await json(a, ['info'])).threadId, b);
  assert.equal((await json(b, ['info'])).profile, beforeBinding.profile);
  assert.equal((await json(b, ['info'])).session, beforeBinding.session);
  evidence.push('Chat A discovers chat B’s legacy account, selects its running browser and clicks its button; chat B observes the click and unchanged page nonce, profile and session. No reopening or login copying.');

  await cli(a, ['account-use', first.accountId]);
  await cli(a, ['--account', second.accountId, '0']);
  assert.equal((await json(a, ['info'])).accountId, first.accountId);
  assert.deepEqual(await state(a, first.accountId), want('ALPHA'));
  assert.deepEqual(await state(b, legacy.accountId), want('GAMMA'));
  await assert.rejects(state(a, second.accountId));
  evidence.push('Explicitly closing account B leaves account A and the other conversation’s account running, and keeps the caller’s selected account unchanged.');

  const otherProject = join(testRoot, 'other-project');
  mkdirSync(otherProject);
  await cli(b, ['account-use', second.accountId]);
  await cli(b, ['1', `${origin}/view`, '--headless'], otherProject);
  assert.deepEqual(await state(b, second.accountId), want('BETA'));
  assert.equal((await json(a, ['info'])).accountId, first.accountId);
  evidence.push('A different conversation reopens a named account in a different working directory with all three stores retained; each conversation retains its own selection.');
  if (host === 'mixed') evidence.push('Installed Codex and Claude adapters control each other’s accounts through the same managed account store without changing caller identity.');
  const result = { passed: true, host, installed, evidence };
  writeFileSync(join(testRoot, 'acceptance.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  for (const id of accounts) { try { await cli(a, ['--account', id, 'close']); } catch {} }
  // Also close B's default if an earlier assertion failed before recording it.
  try { await cli(b, ['close']); } catch {}
  await new Promise(ok => server.close(ok));
}
