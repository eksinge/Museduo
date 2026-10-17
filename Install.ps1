$ErrorActionPreference = 'Stop'
$pluginSource = $PSScriptRoot
$pluginVersion = (Get-Content -LiteralPath (Join-Path $pluginSource 'package.json') -Raw | ConvertFrom-Json).version
$marketplaceRoot = Join-Path $env:LOCALAPPDATA 'CodexMuse\marketplace'
$pluginTarget = Join-Path $marketplaceRoot "plugins\muse-chat-isolation-$pluginVersion"
Get-Command node,codex -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Force -Path $pluginTarget | Out-Null
Get-ChildItem -LiteralPath $pluginSource -Force | Where-Object { $_.Name -notin @('node_modules', '.git') } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $pluginTarget -Recurse -Force
}
$catalogDirectory = Join-Path $marketplaceRoot '.agents\plugins'
New-Item -ItemType Directory -Force -Path $catalogDirectory | Out-Null
$catalog = @{
    name = 'muse-local'
    interface = @{ displayName = 'Museduo 本地插件' }
    plugins = @(@{
        name = 'muse-chat-isolation'
        source = @{ source = 'local'; path = "./plugins/muse-chat-isolation-$pluginVersion" }
        policy = @{ installation = 'AVAILABLE'; authentication = 'ON_INSTALL' }
        category = 'Productivity'
    })
}
$catalog | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $catalogDirectory 'marketplace.json') -Encoding utf8NoBOM
& node (Join-Path $pluginTarget 'scripts\muse.mjs') setup
if ($LASTEXITCODE -ne 0) { throw '运行时安装失败' }
& codex plugin marketplace add $marketplaceRoot --json
if ($LASTEXITCODE -ne 0) { throw '本地市场注册失败' }
& codex plugin add 'muse-chat-isolation@muse-local' --json
if ($LASTEXITCODE -ne 0) { throw '插件安装失败' }
Write-Output '插件已安装。新建 Codex 对话，选择 Museduo，输入：为这个对话打开独立的 Muse 登录窗口。'
