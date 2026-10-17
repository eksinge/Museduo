# Museduo 功能验收标准 · Behavior contract

实现方式可以是复制、适配或重写；以下行为必须保持一致。The code may be copied, adapted or rewritten; these behaviors are required.

| Requirement / 要求 | Acceptance / 验收 |
| --- | --- |
| 默认名称 / Default name | The installed feature is displayed as **Museduo**; lowercase `museduo` is allowed for host command identifiers. |
| 对话隔离 / Conversation isolation | Two conversations in the same project can log in to different Muse accounts without sharing cookies, localStorage, IndexedDB or browser profiles. |
| 真实身份 / Real identity | Use the host's real conversation/session ID. No identity means an explicit error, never a shared default profile. |
| 持久化 / Persistence | Close/reopen or resume the same conversation and retain that conversation's profile, subject to Muse session expiry. |
| 不依赖项目路径 / Stable across directories | Changing the working directory does not change the same conversation's account binding. |
| 新建及分叉 / New and forked chats | A new host ID gets a new profile and does not inherit the source conversation's login. |
| 宿主隔离 / Host namespaces | Claude Code and Codex cannot collide even when their raw conversation IDs are equal. Existing Codex bindings remain compatible. |
| 浏览器操作 / Browser operation | Open a dedicated visible Chrome window at https://muse.ai/; support snapshots, navigation, clicks, fills, keys, tab selection and screenshots. |
| 用户认证 / User authentication | The user completes passwords, CAPTCHA, verification codes and MFA. Do not capture or export credentials or copy another browser's login. |
| 范围内关闭 / Scoped closing | Close only the current conversation's browser, preserve its profile, and leave other conversations running. |
| 可发现的安装 / Discoverable installation | Install persistently in the requested host's supported plugin/skill location and confirm the host can find it. |
| 无旁路 / No shared fallback | Do not substitute ordinary shared Chrome tabs, global default sessions, account switching within one profile, or project-based IDs. |
| 保留已有配置 / Preserve existing state | Keep other plugins, host settings, proxy settings and existing profiles. Do not delete account data automatically. |

Tests should demonstrate different account storage values in two concurrent sessions, unchanged session B after closing A, and retained storage after reopening A in another directory. Tests use synthetic identities only. Live host verification must use the real current host ID.
