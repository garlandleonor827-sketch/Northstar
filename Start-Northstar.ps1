$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolRoot = Split-Path -Parent $projectRoot
Set-Location -LiteralPath $projectRoot

# The Rust toolchain is kept on the project drive so the launcher does not
# depend on a machine-wide PATH entry.
$env:RUSTUP_HOME = Join-Path $toolRoot 'rustup'
$env:CARGO_HOME = Join-Path $toolRoot 'cargo-home'
$env:PATH = "$($env:CARGO_HOME)\bin;$($env:PATH)"

& npm.cmd run tauri:dev
exit $LASTEXITCODE

