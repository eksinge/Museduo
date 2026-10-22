import test from 'node:test';
import assert from 'node:assert/strict';
import { browserConfig } from '../scripts/muse.mjs';

const account = { profile: 'C:/data/chats/abc/profile', directory: 'C:/data/chats/abc' };

test('headed windows start maximized, never full screen', () => {
  const { launchOptions, contextOptions } = browserConfig(account, false).browser;
  assert.equal(launchOptions.headless, false);
  assert.deepEqual(launchOptions.args, ['--start-maximized']);
  assert.equal(contextOptions.viewport, null);
});

test('headless runs add no window-state flag', () => {
  const { launchOptions } = browserConfig(account, true).browser;
  assert.equal(launchOptions.headless, true);
  assert.deepEqual(launchOptions.args, []);
});

test('browser config stays pinned to the account profile', () => {
  const { browser } = browserConfig(account, false);
  assert.equal(browser.userDataDir, account.profile);
  assert.equal(browser.isolated, false);
  assert.equal(browser.launchOptions.channel, 'chrome');
});
