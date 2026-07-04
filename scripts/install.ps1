# Guiguzi Installer - Windows
# Usage: iwr -useb https://guiguzi.ai/install.ps1 | iex

$ErrorActionPreference = "Stop"
$Version = "0.1.0-alpha"
$NpmPackage = "guiguzi"

function Write-Info { param($msg) Write-Host "⟨guiguzi⟩ " -ForegroundColor Cyan -NoNewline; Write-Host $msg }
function Write-Ok   { param($msg) Write-Host "✓ " -ForegroundColor Green -NoNewline; Write-Host $msg }
function Write-Warn { param($msg) Write-Host "⚠ " -ForegroundColor Yellow -NoNewline; Write-Host $msg }
function Write-Err  { param($msg) Write-Host "✗ " -ForegroundColor Red -NoNewline; Write-Host $msg }

function Ensure-Node {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $ver = (node -v).TrimStart('v').Split('.')[0]
        if ([int]$ver -ge 22) {
            Write-Ok "Node.js $(node -v) detected"
            return
        }
        Write-Warn "Node.js $(node -v) found but >= 22 required"
    }

    Write-Info "Installing Node.js 22..."

    # Try winget first
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        return
    }
    # Try Chocolatey
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install nodejs-lts -y
        return
    }
    # Try Scoop
    if (Get-Command scoop -ErrorAction SilentlyContinue) {
        scoop install nodejs-lts
        return
    }
    # Fallback: portable Node
    Write-Info "Downloading portable Node.js..."
    $nodeDir = "$env:LOCALAPPDATA\Guiguzi\deps\portable-node"
    New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
    $zipUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
    $zipPath = "$env:TEMP\node.zip"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $nodeDir -Force
    Remove-Item $zipPath
    $nodeBin = (Get-ChildItem "$nodeDir\node-*" -Directory).FullName
    $env:PATH = "$nodeBin;$env:PATH"
    [Environment]::SetEnvironmentVariable("PATH", "$nodeBin;$env:PATH", "User")
    Write-Ok "Portable Node.js installed"
}

function Install-Guiguzi {
    Write-Info "Installing Guiguzi via npm..."
    $tempDir = Join-Path $env:TEMP "guiguzi-install"
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
    Push-Location $tempDir
    try {
        npm install -g "$NpmPackage@latest"
        Write-Ok "Guiguzi installed"
    } finally {
        Pop-Location
        Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    }
}

function Post-Install {
    Write-Info "Running post-install checks..."
    if (Get-Command guiguzi -ErrorAction SilentlyContinue) {
        Write-Ok "guiguzi command available"
    } else {
        Write-Warn "guiguzi not found in PATH. You may need to restart your terminal."
    }
}

Write-Host ""
Write-Host "╔═══════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Guiguzi Installer v$Version    ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Ensure-Node
Install-Guiguzi
Post-Install

Write-Host ""
Write-Ok "Installation complete!"
Write-Info "Run 'guiguzi onboard' to get started."
Write-Host ""
