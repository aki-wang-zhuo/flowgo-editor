# 将编辑器构建产物复制到 flowgo-server/editor，供服务端静态托管。
$ErrorActionPreference = "Stop"
$EditorDir = $PSScriptRoot
$ServerEditor = Join-Path (Split-Path $EditorDir -Parent) "flowgo-server\editor"

Push-Location $EditorDir
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "editor build failed" }
} finally {
  Pop-Location
}

if (Test-Path $ServerEditor) {
  Remove-Item -Recurse -Force $ServerEditor
}
New-Item -ItemType Directory -Force -Path $ServerEditor | Out-Null
Copy-Item -Recurse -Force (Join-Path $EditorDir "dist\*") $ServerEditor
Write-Host "已复制到 $ServerEditor"
