# Museduo

让 Codex 在不同的对话中打开不同的 Muse 账号。

Let Codex open different Muse accounts in different conversations.

## 中文

Museduo 是 Codex 本地插件，为每个对话分配独立、持久化的 Chrome 资料目录。不同对话可登录不同的 Muse 账号；恢复同一对话时会继续使用自己的登录资料，直到 Muse 要求重新认证。新建或分叉对话使用新的资料目录。

### 安装与使用

需要 Windows、Node.js 20+（含 npm）、Google Chrome，以及支持本地插件的 Codex。

1. 下载本仓库 ZIP 并解压，或运行 `git clone https://github.com/eksinge/Museduo.git`。
2. 在 Codex 的 PowerShell 中运行：

```powershell
& '<Museduo 文件夹绝对路径>\Install.ps1'
```

3. 新建 Codex 对话，选择 **Museduo**，发送：**为这个对话打开独立的 Muse 登录窗口。**
4. 在专属 Chrome 窗口中手动登录。另一个对话重复操作，即可登录另一个账号。

关闭时可告诉 Codex：**关闭这个对话的 Muse 浏览器，保留登录。** 如果插件列表没有刷新，请重新启动 Codex。

安装脚本使用 Codex 官方 CLI 注册本地市场并安装插件。依赖通过锁文件安装，禁用 npm 生命周期脚本。

### 隔离与隐私

- 使用真实 `CODEX_THREAD_ID`（兼容 `CODEX_SESSION_ID`）的 SHA-256 固定浏览器会话及资料目录；缺少有效身份时拒绝运行。
- 资料保存在本机 `%LOCALAPPDATA%\CodexMuse\chats\<hash>\profile`，不会上传至插件作者。不要将该目录上传至 GitHub。
- 密码、验证码和 MFA 由用户手动完成；插件不会代填或导出登录凭据。
- 通过独立 Chrome 窗口工作。这是登录状态隔离，不是操作系统安全沙箱。
- Museduo 沿用原插件 ID `muse-chat-isolation@muse-local` 和资料路径，保留已有对话的账号绑定。

### 验证与移除

`npm test` 检查身份、会话隔离和绑定保护。
`npm run test:e2e` 使用临时目录和虚构测试身份，启动真实 Chrome，验证 Cookie、localStorage、IndexedDB 隔离、重开持久化及切换工作目录后的绑定稳定性。测试不使用真实 Muse 账号。

运行 `codex plugin remove muse-chat-isolation@muse-local` 卸载插件。卸载不自动删除登录资料。

## English

Museduo is a local Codex plugin that gives each conversation its own persistent Chrome profile. Different conversations can sign in to different Muse accounts. Resuming a conversation reuses its profile until Muse requires authentication again. New or forked conversations receive fresh profiles.

### Install and use

Requires Windows, Node.js 20+ with npm, Google Chrome, and Codex with local plugin support.

1. Download and extract this repository, or run `git clone https://github.com/eksinge/Museduo.git`.
2. In a Codex PowerShell terminal, run:

```powershell
& '<absolute path to Museduo>\Install.ps1'
```

3. Start a new Codex conversation, select **Museduo**, and ask: **Open a separate Muse login window for this conversation.**
4. Sign in manually in the dedicated Chrome window. Repeat in another conversation to use another account.

To close it, ask: **Close this conversation's Muse browser and keep its login profile.** Restart Codex if the plugin list has not refreshed.

The installer registers a local marketplace and installs the plugin through the official Codex CLI. Dependencies use a pinned lockfile with npm lifecycle scripts disabled.

### Isolation and privacy

- A SHA-256 hash of the real `CODEX_THREAD_ID` (or `CODEX_SESSION_ID`) determines the browser session and profile. Missing or invalid identity is rejected.
- Profiles stay locally at `%LOCALAPPDATA%\CodexMuse\chats\<hash>\profile`. They are not sent to the plugin author. Never upload this directory to GitHub.
- Users enter passwords, verification codes, and MFA themselves. The plugin does not enter or export login credentials.
- The plugin uses a dedicated Chrome window. It isolates login state; it is not an operating-system security sandbox.
- Museduo keeps the existing plugin ID `muse-chat-isolation@muse-local` and profile paths so existing conversation bindings are preserved.

### Verify and uninstall

`npm test` checks identity handling, session isolation, and binding protection.
`npm run test:e2e` starts real Chrome with temporary profiles and synthetic identities to verify Cookie, localStorage, and IndexedDB isolation, persistence after reopening, and stable bindings across working directories. It does not use real Muse accounts.

Run `codex plugin remove muse-chat-isolation@muse-local` to uninstall. Uninstalling does not automatically delete login profiles.

## Dependencies and license / 依赖与许可

- [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli), pinned to `@playwright/cli@0.1.22`.
- MIT license. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
