# Museduo

让 Codex / Claude Code 在 (不同的/一个) 对话中打开不同的 Muse 账号

Manage multiple independent Muse accounts in one conversation, and reuse account windows opened by other conversations.

## 使用方法

复制此项目地址给 Codex / Claude Code，直接给 Codex / Claude Code 发：**我需要这个项目**。

```text
https://github.com/eksinge/Museduo
我需要这个项目
```

也可以说“我需要这个插件”“把这个插件迁移到我的 Codex / Claude Code 中”“在我的电脑上安装这个插件”“让我的 Codex / Claude Code 有这个插件的功能”等。目标都是在你的电脑上装好 **Museduo**，由接收请求的代理读取仓库并完成安装、适配和验证。

Codex 与 Claude Code 均支持相同功能。给 Claude Code 仓库地址并说明“请安装并实现这个插件的全部功能”，它应读取 CLAUDE.md、INSTALL.md 和 FUNCTIONALITY.md，完成安装与验证；仅阅读文件不会自动安装。普通 Claude 网页对话没有本机终端能力，不能单靠读取仓库控制你的电脑。

| 能力 | Codex | Claude Code |
| --- | --- | --- |
| 不同对话使用不同默认账号 | 支持 | 支持 |
| 一个对话打开多个独立账号窗口 | 支持 | 支持 |
| 接管其他对话已有的账号窗口 | 支持 | 支持 |
| 账号命名、切换、关闭后保留登录 | 支持 | 支持 |
| 明确选择本机另一宿主的账号 | 支持 | 支持 |

首次打开后，在独立 Chrome 窗口中手动登录 Muse。每个账号保存独立登录资料。一个对话可以打开多个账号窗口，也可以从账号列表选择其他对话已经打开的窗口，无需重新登录。

直接在对话中说：

- “新建账号 A 和账号 B，分别打开登录窗口。”
- “列出所有 Muse 账号。”
- “切换到账号 A。”
- “控制另一个对话打开的那个账号。”（有多个候选时指定账号名称。）

原来登录过的账号会自动识别，原资料目录、会话和窗口保持可复用。可以给旧账号起一个容易识别的名字。切换已有窗口不需要再次打开窗口。

安装并选择 **Museduo** 后，在使用它的对话中直接发送：

- **`1`**：以最大化窗口（非全屏，标签页和任务栏仍可见）打开当前选中的账号窗口。
- **`0`**：只关闭当前选中的账号窗口，保留登录。其他账号窗口继续运行。

同一账号窗口可以被多个对话使用；关闭这个账号的窗口时，这些对话都会看到它已关闭。多个对话不要同时编辑同一个页面；插件会阻止同一账号的命令同时执行。

开发者命令：`account-list`、`account-new "名称"`、`account-use <ID或名称>`、`account-rename <ID> "名称"`。多账号操作时，每条浏览器命令前加 `--account <ID>` 明确目标。账号列表表示本地登记，不等于窗口正在打开或已经登录。

## How to use

Copy this repository URL to Codex / Claude Code and send: **I need this project**.

```text
https://github.com/eksinge/Museduo
I need this project
```

You can also ask to install this plugin, migrate it to Codex / Claude Code, or give your coding agent the same features. The agent reads the repository, installs or adapts the feature on your computer, and verifies it. The default local name is **Museduo**.

Sign in manually in each dedicated account window. Create multiple accounts in one conversation, or explicitly select an account opened in another conversation. Existing account windows and legacy profiles are reused without login copying. Each conversation saves its own selection; per-command --account <ID> overrides do not change it.

After installing and selecting **Museduo**, send a standalone message in that conversation:

- **`1`**: open the selected account in a maximized window (not full screen; the tab strip and taskbar stay visible).
- **`0`**: close only the selected account and retain its profile. Other accounts remain running. Other conversations controlling the same account observe its window closing.

## 给 Codex / Claude Code / For coding agents

If the user sent this URL and requested this feature, read **[AGENTS.md](AGENTS.md)**, **[INSTALL.md](INSTALL.md)** and **[FUNCTIONALITY.md](FUNCTIONALITY.md)**, then complete the requested local installation. Claude Code should also read **[CLAUDE.md](CLAUDE.md)**. Opening a URL does not automatically load those files: fetch and read them explicitly. If GitHub's page view omits file contents, start with the **[raw installation guide](https://raw.githubusercontent.com/eksinge/Museduo/main/INSTALL.md)**, or download the **[repository ZIP](https://github.com/eksinge/Museduo/archive/refs/heads/main.zip)**. Follow the user's actual request and host permissions.

The repository includes a Codex plugin installer and a standalone Claude Code skill installer. Reuse the implementation, adapt it or rewrite it locally when needed; preserve the full behavior contract and the name Museduo. Complete host discovery and browser verification before calling installation finished.

## 环境与功能 / Environment and features

- 需要可操作本机文件和终端的 Codex / Claude Code、Node.js 20+（含 npm）和 Chrome。Requires local file/shell access, Node.js 20+ with npm, and Chrome.
- Windows 已验证；其他系统由代理按本机环境适配和验证。Windows is tested; other platforms require local adaptation and verification.
- 每个账号使用独立持久化资料；每个对话记住自己选择的账号。Profiles are per account; selections are per real conversation and independent of project directories. Without an explicit selection, original conversation profiles remain the default.
- 登录资料留在本机，密码及验证码由用户输入。Profiles stay local; users enter passwords and verification codes themselves.
- Codex 保留原插件 ID `muse-chat-isolation@muse-local` 和已有资料路径；Claude Code 使用独立命名空间。Existing Codex bindings are preserved; Claude Code has a separate namespace.

详细安装、测试和适配步骤见 [INSTALL.md](INSTALL.md)。Detailed installation, verification and adaptation instructions are in [INSTALL.md](INSTALL.md).

## License / 许可

MIT. Uses pinned [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli). See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
