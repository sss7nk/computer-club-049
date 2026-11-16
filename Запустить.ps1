$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$clubNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $clubNode)) { $clubNode = (Get-Command node -ErrorAction Stop).Source }
$clubMajor = [int]((& $clubNode --version).TrimStart('v').Split('.')[0])
if ($clubMajor -lt 24) { throw 'Нужен Node.js 24 или новее.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) { throw 'Сначала выполните npm install в папке сайта.' }
Write-Host 'Откройте в браузере http://127.0.0.1:4173'
& $clubNode 'server/local.mjs'
