# Museduo

让 Codex / Claude Code 在不同的对话中打开不同的 Muse 账号。

Let Codex / Claude Code open different Muse accounts in different conversations.

## 使用方法

复制此项目地址给 Codex / Claude Code，直接给 Codex / Claude Code 发：**我需要这个项目**。

```text
https://github.com/eksinge/Museduo
我需要这个项目
```

也可以说“我需要这个插件”“把这个插件迁移到我的 Codex / Claude Code 中”“在我的电脑上安装这个插件”“让我的 Codex / Claude Code 有这个插件的功能”等。目标都是在你的电脑上装好 **Museduo**，由接收请求的代理读取仓库并完成安装、适配和验证。

首次打开后，在专属 Chrome 窗口中手动登录 Muse。另一个对话可以登录另一个账号；恢复同一对话会复用自己的资料，直到 Muse 要求重新认证。

安装并选择 **Museduo** 后，在使用它的对话中直接发送：

- **`1`**：打开当前对话的 Muse 浏览器。
- **`0`**：关闭当前对话的浏览器，保留登录资料。

## How to use

Copy this repository URL to Codex / Claude Code and send: **I need this project**.

```text
https://github.com/eksinge/Museduo
I need this project
```

You can also ask to install this plugin, migrate it to Codex / Claude Code, or give your coding agent the same features. The agent reads the repository, installs or adapts the feature on your computer, and verifies it. The default local name is **Museduo**.

Sign in manually in the dedicated Chrome window. Other conversations can use other Muse accounts; resuming the same conversation reuses its own profile, subject to Muse session expiry.

After installing and selecting **Museduo**, send a standalone message in that conversation:

- **`1`**: open this conversation's Muse browser.
- **`0`**: close this conversation's browser and keep its login profile.

## 给 Codex / Claude Code / For coding agents

If the user sent this URL and requested this feature, read **[AGENTS.md](AGENTS.md)**, **[INSTALL.md](INSTALL.md)** and **[FUNCTIONALITY.md](FUNCTIONALITY.md)**, then complete the requested local installation. Claude Code should also read **[CLAUDE.md](CLAUDE.md)**. Opening a URL does not automatically load those files: fetch and read them explicitly. If GitHub's page view omits file contents, start with the **[raw installation guide](https://raw.githubusercontent.com/eksinge/Museduo/main/INSTALL.md)**, or download the **[repository ZIP](https://github.com/eksinge/Museduo/archive/refs/heads/main.zip)**. Follow the user's actual request and host permissions.

The repository includes a Codex plugin installer and a standalone Claude Code skill installer. Reuse the implementation, adapt it or rewrite it locally when needed; preserve the full behavior contract and the name Museduo. Complete host discovery and browser verification before calling installation finished.

## 环境与功能 / Environment and features

- 需要可操作本机文件和终端的 Codex / Claude Code、Node.js 20+（含 npm）和 Chrome。Requires local file/shell access, Node.js 20+ with npm, and Chrome.
- Windows 已验证；其他系统由代理按本机环境适配和验证。Windows is tested; other platforms require local adaptation and verification.
- 每个真实对话 ID 对应独立持久化资料；切换项目路径不会换账号。One persistent profile per real conversation ID, independent of the project directory.
- 登录资料留在本机，密码及验证码由用户输入。Profiles stay local; users enter passwords and verification codes themselves.
- Codex 保留原插件 ID `muse-chat-isolation@muse-local` 和已有资料路径；Claude Code 使用独立命名空间。Existing Codex bindings are preserved; Claude Code has a separate namespace.

详细安装、测试和适配步骤见 [INSTALL.md](INSTALL.md)。Detailed installation, verification and adaptation instructions are in [INSTALL.md](INSTALL.md).

## License / 许可

MIT. Uses pinned [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli). See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
