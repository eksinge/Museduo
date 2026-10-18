# Museduo 功能验收标准 · Behavior contract

实现方式可以是复制、适配或重写；以下行为必须保持一致。The code may be copied, adapted or rewritten; these behaviors are required.

| Requirement / 要求 | Acceptance / 验收 |
| --- | --- |
| 默认名称 / Default name | The installed feature is displayed as **Museduo**; lowercase `museduo` is allowed for host command identifiers. |
| 数字快捷指令 / Numeric shortcuts | A standalone `1` opens the currently selected account; `0` closes only that account's window and preserves its profile. Without a selection, use the conversation's original default. Both hosts support the messages and CLI aliases; numbers in unrelated text or numbered choices are not browser commands. |
| 账号隔离 / Account isolation | Every account has independent cookies, localStorage, IndexedDB and browser profile, including multiple accounts created by one conversation. Tabs in one account share its login. |
| 单对话多账号 / Multiple accounts per conversation | Create named accounts with account-new, list managed accounts with account-list, select with account-use, and name legacy accounts with account-rename. Several windows may remain open concurrently. |
| 跨对话控制 / Cross-conversation control | Conversation A can explicitly select an account opened in conversation B and control the same running window without reopening, copying credentials or changing the original profile/session. Existing legacy bindings are automatically discovered. |
| 独立选择 / Per-conversation selection | Each conversation retains its own selected account across command invocations and project directory changes. --account <ID> explicitly targets one command without changing that selection. Unknown or ambiguous names must fail rather than choose another account. |
| 真实身份 / Real identity | Use the host's real conversation/session ID. No identity means an explicit error, never a shared default profile. |
| 持久化 / Persistence | Any conversation may explicitly reopen the same account and retain its profile, subject to Muse session expiry. |
| 不依赖项目路径 / Stable across directories | Changing the working directory does not change the same conversation's account binding. |
| 新建及分叉 / New and forked chats | Without an explicit account selection, a new host ID defaults to its own profile and does not inherit the source conversation's selection or login. |
| 宿主隔离 / Host namespaces | Claude Code and Codex default profiles cannot collide even with equal raw IDs. Explicit account selection may reuse a managed account across hosts. Existing Codex paths remain compatible. |
| 浏览器操作 / Browser operation | Open a dedicated visible Chrome window in full-screen mode by default at https://muse.ai/, including when using an explicit URL. F11 exits full screen; headless tests remain headless. Support snapshots, navigation, clicks, fills, keys, tab selection and screenshots. |
| 用户认证 / User authentication | The user completes passwords, CAPTCHA, verification codes and MFA. Do not capture or export credentials or copy another browser's login. |
| 范围内关闭 / Scoped closing | Close only the targeted account and preserve its profile; leave other accounts running. All conversations controlling that same account observe its window closing. |
| 并发命令 / Concurrent commands | Browser commands to one account cannot overlap across conversations. Commands to different accounts can run independently. A busy command must fail clearly. Refresh snapshot refs after switching or another controller's actions; the lock is per command, not a reservation for a whole task. |
| 可发现的安装 / Discoverable installation | Install persistently in the requested host's supported plugin/skill location and confirm the host can find it. |
| 无旁路 / No shared fallback | Do not substitute ordinary shared Chrome tabs, global default sessions, account switching within one profile, or project-based IDs. |
| 保留已有配置 / Preserve existing state | Keep other plugins, host settings, proxy settings and existing profiles. Do not delete account data automatically. |

Tests must demonstrate two accounts opened by one conversation, a different conversation's running legacy account being controlled without reopening, three independent storage types, unchanged other accounts after scoped closing, and cross-conversation reopening with retained storage in a different directory. Test both host adapters using synthetic identities only. Live host verification must use the real current host ID. Never package private profiles or credentials.
