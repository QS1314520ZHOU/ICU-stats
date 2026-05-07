$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ImageName = if ($env:IMAGE_NAME) { $env:IMAGE_NAME } else { "icu-stats-oel8-binary-builder" }
$OutDir = if ($env:OUT_DIR) { $env:OUT_DIR } else { Join-Path $RootDir "release\oel8-binary" }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host "Building OEL8.2 binary in Docker..."
docker build -f (Join-Path $RootDir "Dockerfile.oel8") -t $ImageName $RootDir

$container = docker create $ImageName
try {
  Get-ChildItem $OutDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
  docker cp "${container}:/out/." $OutDir
} finally {
  docker rm $container | Out-Null
}

Write-Host ""
Write-Host "Generated package:"
Get-ChildItem $OutDir
Write-Host ""
Write-Host "Next:"
Write-Host "  cd $OutDir"
Write-Host "  copy .env.example .env"
Write-Host "  edit .env"
Write-Host "  .\run.sh"
