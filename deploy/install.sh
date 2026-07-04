#!/usr/bin/env bash
# Guiguzi Linux Installer
# Usage: curl -fsSL https://get.guiguzi.dev | bash
#    or: bash install.sh
set -euo pipefail

VERSION="0.1.0-alpha"
INSTALL_DIR="/opt/guiguzi"
DATA_DIR="/var/lib/guiguzi"
LOG_DIR="/var/log/guiguzi"
CONFIG_DIR="/etc/guiguzi"
SERVICE_USER="guiguzi"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; exit 1; }

# ─── Pre-flight checks ───
[[ $EUID -eq 0 ]] || error "Please run as root (sudo bash install.sh)"

info "Installing Guiguzi v${VERSION}..."

# Check Node.js
if ! command -v node &>/dev/null; then
    warn "Node.js not found. Installing via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
[[ $NODE_VER -ge 22 ]] || error "Node.js 22+ required (found v${NODE_VER})"
info "Node.js $(node --version)"

# Check pnpm
if ! command -v pnpm &>/dev/null; then
    warn "pnpm not found. Installing..."
    npm install -g pnpm
fi
info "pnpm $(pnpm --version)"

# ─── Create service user ───
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --shell /usr/sbin/nologin --home-dir "$INSTALL_DIR" "$SERVICE_USER"
    info "Created service user: $SERVICE_USER"
fi

# ─── Create directories ───
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR" "$CONFIG_DIR"
info "Created directories"

# ─── Install application ───
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$SCRIPT_DIR/package.json" ]]; then
    # Install from source
    info "Installing from source: $SCRIPT_DIR"
    cd "$SCRIPT_DIR"
    pnpm install --prod
    pnpm build
    cp -r . "$INSTALL_DIR/"
else
    # Download release tarball
    TARBALL="guiguzi-${VERSION}.tar.gz"
    warn "Source not found. Downloading release..."
    curl -fsSL "https://github.com/guiguzi/guiguzi/releases/download/v${VERSION}/${TARBALL}" -o "/tmp/${TARBALL}"
    tar -xzf "/tmp/${TARBALL}" -C "$INSTALL_DIR" --strip-components=1
    cd "$INSTALL_DIR"
    pnpm install --prod
fi
info "Application installed to $INSTALL_DIR"

# ─── Configuration ───
if [[ ! -f "$CONFIG_DIR/env" ]]; then
    cp "$INSTALL_DIR/deploy/systemd/guiguzi.env" "$CONFIG_DIR/env"
    chmod 600 "$CONFIG_DIR/env"
    warn "Created config at /etc/guiguzi/env — edit it to add your API keys"
fi

# ─── Systemd service ───
cp "$INSTALL_DIR/deploy/systemd/guiguzi-gateway.service" /etc/systemd/system/
systemctl daemon-reload
info "Systemd service installed"

# ─── Permissions ───
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR" "$CONFIG_DIR"

# ─── CLI symlink ───
ln -sf "$INSTALL_DIR/packages/nova-cli/dist/index.js" /usr/local/bin/nova
chmod +x "$INSTALL_DIR/packages/nova-cli/dist/index.js"
info "CLI available as: nova"

# ─── Summary ───
echo ""
echo "═══════════════════════════════════════════"
echo "  Guiguzi v${VERSION} installed!"
echo "═══════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "    1. Edit config:  sudo nano /etc/guiguzi/env"
echo "    2. Start gateway: sudo systemctl enable --now guiguzi-gateway"
echo "    3. Check status:  sudo systemctl status guiguzi-gateway"
echo "    4. Use CLI:       nova agent"
echo "    5. Health check:  nova doctor"
echo ""
echo "  Docs: https://github.com/guiguzi/guiguzi"
echo ""
