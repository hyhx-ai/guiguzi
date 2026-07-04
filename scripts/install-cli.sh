#!/usr/bin/env bash
# Guiguzi Local Prefix Installer
# Installs everything under ~/.guiguzi (no system Node needed)
# Usage: curl -fsSL https://guiguzi.ai/install-cli.sh | bash

set -euo pipefail

VERSION="0.1.0-alpha"
PREFIX="${GUIGUZI_PREFIX:-$HOME/.guiguzi}"
NODE_VERSION="22.14.0"
NODE_DISTRO="linux-x64"
NPM_PACKAGE="guiguzi"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { echo -e "${CYAN}⟨guiguzi⟩${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
err()   { echo -e "${RED}✗${NC} $*" >&2; }

detect_platform() {
  local os arch
  case "$(uname -s)" in
    Linux*)  os="linux" ;;
    Darwin*) os="darwin" ;;
    *)       err "Unsupported OS"; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)  arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *)             err "Unsupported arch"; exit 1 ;;
  esac
  NODE_DISTRO="${os}-${arch}"
}

install_node() {
  local node_dir="$PREFIX/tools/node-v${NODE_VERSION}-${NODE_DISTRO}"
  if [ -d "$node_dir" ]; then
    ok "Node.js already installed at $node_dir"
  else
    info "Downloading Node.js ${NODE_VERSION}..."
    mkdir -p "$PREFIX/tools"
    local tarball="node-v${NODE_VERSION}-${NODE_DISTRO}.tar.xz"
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${tarball}" -o "/tmp/${tarball}"

    # Verify checksum
    local sha_file="/tmp/node-sha256"
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -o "$sha_file"
    local expected
    expected=$(grep "$tarball" "$sha_file" | awk '{print $1}')
    local actual
    actual=$(sha256sum "/tmp/${tarball}" | awk '{print $1}')
    if [ "$expected" != "$actual" ]; then
      err "SHA-256 mismatch! Aborting."
      exit 1
    fi

    tar -xJf "/tmp/${tarball}" -C "$PREFIX/tools"
    rm -f "/tmp/${tarball}" "$sha_file"
    ok "Node.js ${NODE_VERSION} installed"
  fi

  export PATH="$node_dir/bin:$PATH"
}

install_guiguzi() {
  info "Installing Guiguzi..."
  mkdir -p "$PREFIX/lib"

  npm install -g "$NPM_PACKAGE@latest" --prefix "$PREFIX/lib" 2>/dev/null || {
    warn "npm install failed, trying from source..."
    local src_dir="$PREFIX/src"
    mkdir -p "$src_dir"
    if [ -d "$src_dir/guiguzi" ]; then
      cd "$src_dir/guiguzi" && git pull
    else
      git clone https://github.com/hyhx-ai/guiguzi.git "$src_dir/guiguzi"
      cd "$src_dir/guiguzi"
    fi
    npm install -g pnpm && pnpm install && pnpm build
  }

  # Create wrapper
  mkdir -p "$PREFIX/bin"
  cat > "$PREFIX/bin/guiguzi" << 'WRAPPER'
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PREFIX="$(dirname "$SCRIPT_DIR")"
export PATH="$PREFIX/tools/node-vNODE_VERSION-NODE_DISTRO/bin:$PREFIX/lib/bin:$PATH"
exec node "$PREFIX/lib/lib/node_modules/guiguzi/dist/cli.js" "$@"
WRAPPER
  chmod +x "$PREFIX/bin/guiguzi"

  ok "Guiguzi installed at $PREFIX/bin/guiguzi"
}

setup_path() {
  local shell_rc=""
  if [ -n "${BASH_VERSION:-}" ]; then
    shell_rc="$HOME/.bashrc"
  elif [ -n "${ZSH_VERSION:-}" ]; then
    shell_rc="$HOME/.zshrc"
  fi

  if [ -n "$shell_rc" ] && ! grep -q "guiguzi/bin" "$shell_rc" 2>/dev/null; then
    echo "" >> "$shell_rc"
    echo "# Guiguzi" >> "$shell_rc"
    echo "export PATH=\"$PREFIX/bin:\$PATH\"" >> "$shell_rc"
    ok "Added $PREFIX/bin to PATH in $shell_rc"
  fi

  export PATH="$PREFIX/bin:$PATH"
}

main() {
  echo ""
  echo -e "${CYAN}⟨guiguzi⟩${NC} Local prefix installer v${VERSION}"
  echo -e "${CYAN}⟨guiguzi⟩${NC} Installing to: $PREFIX"
  echo ""

  detect_platform
  info "Platform: $NODE_DISTRO"

  install_node
  install_guiguzi
  setup_path

  echo ""
  ok "Installation complete!"
  info "Run 'guiguzi onboard' to get started."
  info "You may need to restart your shell or run: export PATH=\"$PREFIX/bin:\$PATH\""
  echo ""
}

main "$@"
