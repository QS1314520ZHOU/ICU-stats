param(
  [string]$ImageName = "icu-stats-oel8-binary-builder",
  [string]$OutputDir = "release\oel8-binary"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root $OutputDir

New-Item -ItemType Directory -Force -Path $out | Out-Null

docker build -f (Join-Path $root "Dockerfile.oel8") -t $ImageName $root

$container = docker create $ImageName
try {
  docker cp "${container}:/out/." $out
} finally {
  docker rm $container | Out-Null
}

Write-Host "OEL 8.2 binary package generated: $out"
Write-Host "Files:"
Get-ChildItem $out
