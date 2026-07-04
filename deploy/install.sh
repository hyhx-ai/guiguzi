#!/usr/bin/env bash
# NovaClaw Linux Installer
# Usage: curl -fsSL https://get.novaclaw.dev | bash
#    or: bash install.sh
set -euo pipefail

VERSION="0.1.0-alpha"
INSTALL_DIR="/opt/novaclaw"
DATA_DIR="/var/lib/novaclaw"
LOG_DIR="/var/log/novaclaw"
CONFIG_DIR="/etc/novaclaw"
SERVICE_USER="novaclaw"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; exit 1; }

# ─── Pre-flight checks ───
[[ $EUID -eq 0 ]] || error "Please run as root (sudo bash install.sh)"

info "Installing NovaClaw v${VERSION}..."

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
    TARBALL="novaclaw-${VERSION}.tar.gz"
    warn "Source not found. Downloading release..."
    curl -fsSL "https://github.com/novaclaw/novaclaw/releases/download/v${VERSION}/${TARBALL}" -o "/tmp/${TARBALL}"
    tar -xzf "/tmp/${TARBALL}" -C "$INSTALL_DIR" --strip-components=1
    cd "$INSTALL_DIR"
    pnpm install --prod
fi
info "Application installed to $INSTALL_DIR"

# ─── Configuration ───
if [[ ! -f "$CONFIG_DIR/env" ]]; then
    cp "$INSTALL_DIR/deploy/systemd/novaclaw.env" "$CONFIG_DIR/env"
    chmod 600 "$CONFIG_DIR/env"
    warn "Created config at /etc/novaclaw/env — edit it to add your API keys"
fi

# ─── Systemd service ───
cp "$INSTALL_DIR/deploy/systemd/novaclaw-gateway.service" /etc/systemd/system/
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
echo "  NovaClaw v${VERSION} installed!"
echo "═══════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "    1. Edit config:  sudo nano /etc/novaclaw/env"
echo "    2. Start gateway: sudo systemctl enable --now novaclaw-gateway"
echo "    3. Check status:  sudo systemctl status novaclaw-gateway"
echo "    4. Use CLI:       nova agent"
echo "    5. Health check:  nova doctor"
echo ""
echo "  Docs: https://github.com/novaclaw/novaclaw"
echo ""
