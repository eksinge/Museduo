import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identity } from '../scripts/muse.mjs';

const exec = promisify(execFile);
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wrapper = join(pluginRoot, 'scripts', 'muse.mjs');
const testRoot = resolve(pluginRoot, '..', '..', 'work', `muse-isolation-${Date.now()}`);
mkdirSync(testRoot, { recursive: true });
mkdirSync(join(testRoot, 'other-project'), { recursive: true });
const env = { ...process.env, MUSE_CHAT_DATA_DIR: testRoot };
const ids = ['e2e-chat-alpha', 'e2e-chat-beta'];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const account = url.searchParams.get('account');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (account) res.setHeader('Set-Cookie', `test_account=${encodeURIComponent(account)}; Path=/; Max-Age=86400; SameSite=Lax`);
  res.end(`<!doctype html><html><head><title>Muse isolation acceptance test</title></head><body><h1>Independent chat profile</h1><p id="account"></p><script>
    const incoming = ${JSON.stringify(account)};
    window.ready = (async () => {
      if(incoming) localStorage.setItem('test_account', incoming);
      const db = await new Promise((ok, fail) => { const r=indexedDB.open('isolation-test',1); r.onupgradeneeded=()=>r.result.createObjectStore('accounts'); r.onsuccess=()=>ok(r.result); r.onerror=()=>fail(r.error); });
      if(incoming) await new Promise((ok, fail)=>{const tx=db.transaction('accounts','readwrite');tx.objectStore('accounts').put(incoming,'current');tx.oncomplete=ok;tx.onerror=()=>fail(tx.error);});
      const indexed = await new Promise((ok,fail)=>{const r=db.transaction('accounts').objectStore('accounts').get('current');r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);});
      db.close();
      document.querySelector('#account').textContent=localStorage.getItem('test_account') || 'EMPTY';
      return { cookie: document.cookie, local: localStorage.getItem('test_account'), indexed: indexed ?? null };
    })();
  </script></body></html>`);
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const evidence = [];
async function cli(thread, args, cwd = pluginRoot) {
  try {
    const result = await exec(process.execPath, [wrapper, ...args], { env: { ...env, CODEX_THREAD_ID: thread }, cwd, windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
    return result.stdout;
  } catch (error) {
    throw new Error(`${thread}: ${args[0]} failed\n${error.stdout || ''}\n${error.stderr || ''}`, { cause: error });
  }
}
async function state(thread, cwd) {
  const raw = await cli(thread, ['eval', 'async () => await window.ready', '--raw'], cwd);
  try { return JSON.parse(raw.trim()); }
  catch { throw new Error(`Cannot parse state: ${raw}`); }
}
try {
  await cli(ids[0], ['setup']);
  await Promise.all(ids.map(id => cli(id, ['open', `${origin}/view`, '--headless'])));
  for (const id of ids) assert.deepEqual(await state(id), { cookie: '', local: null, indexed: null });
  evidence.push('Two concurrent new chats start with empty cookies, localStorage and IndexedDB.');
  await Promise.all([
    cli(ids[0], ['goto', `${origin}/set?account=ACCOUNT_ALPHA`]),
    cli(ids[1], ['goto', `${origin}/set?account=ACCOUNT_BETA`])
  ]);
  const a = await state(ids[0]);
  const b = await state(ids[1]);
  assert.deepEqual(a, { cookie: 'test_account=ACCOUNT_ALPHA', local: 'ACCOUNT_ALPHA', indexed: 'ACCOUNT_ALPHA' });
  assert.deepEqual(b, { cookie: 'test_account=ACCOUNT_BETA', local: 'ACCOUNT_BETA', indexed: 'ACCOUNT_BETA' });
  evidence.push('Same origin holds different persistent cookies, localStorage and IndexedDB in the two chats.');
  await cli(ids[0], ['open', `${origin}/view`, '--headless']);
  assert.deepEqual(await state(ids[0]), a);
  evidence.push('Opening an already-running chat again keeps the same profile without a lock conflict.');
  await cli(ids[0], ['close']);
  assert.deepEqual(await state(ids[1]), b);
  evidence.push('Closing chat A does not close or change chat B.');
  await cli(ids[0], ['open', `${origin}/view`, '--headless'], join(testRoot, 'other-project'));
  assert.deepEqual(await state(ids[0], join(testRoot, 'other-project')), a);
  evidence.push('Reopened chat A retains all three stores after browser restart and a change of working directory.');
  const profiles = ids.map(id => identity({ ...env, CODEX_THREAD_ID: id }).profile);
  assert.notEqual(profiles[0], profiles[1]);
  evidence.push('Browser profile paths are distinct and deterministically derived from thread IDs.');
  console.log(JSON.stringify({ passed: true, origin, evidence, profiles }, null, 2));
  writeFileSync(join(testRoot, 'acceptance.json'), JSON.stringify({ passed: true, evidence, profiles }, null, 2));
} finally {
  for (const id of ids) { try { await cli(id, ['close']); } catch {} }
  await new Promise(ok => server.close(ok));
}
