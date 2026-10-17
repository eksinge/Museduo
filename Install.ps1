param([ValidateSet('codex', 'claude')][string]$HostApp = 'codex')
$ErrorActionPreference = 'Stop'
Get-Command node -ErrorAction Stop | Out-Null
& node (Join-Path $PSScriptRoot 'scripts\install.mjs') --host $HostApp
if ($LASTEXITCODE -ne 0) { throw 'Museduo installation failed. Check the error above.' }
