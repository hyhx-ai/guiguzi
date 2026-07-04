#!/usr/bin/env bash
# Guiguzi Installer - Linux / macOS
# Usage: curl -fsSL https://guiguzi.ai/install.sh | bash

set -euo pipefail

# Prevent debconf interactive dialogs (e.g. "which services to restart")
export DEBIAN_FRONTEND=noninteractive

VERSION="0.1.0-alpha"
REPO_URL="https://github.com/hyhx-ai/guiguzi.git"
NPM_PACKAGE="guiguzi"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}⟨guiguzi⟩${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
err()   { echo -e "${RED}✗${NC} $*" >&2; }

# Detect OS
detect_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "macos" ;;
    *)       err "Unsupported OS: $(uname -s)"; exit 1 ;;
  esac
}

# Detect package manager
detect_pkg_manager() {
  if command -v apt-get &>/dev/null; then echo "apt"
  elif command -v dnf &>/dev/null; then echo "dnf"
  elif command -v yum &>/dev/null; then echo "yum"
  elif command -v apk &>/dev/null; then echo "apk"
  elif command -v brew &>/dev/null; then echo "brew"
  else echo "unknown"
  fi
}

# Ensure npm global bin is in PATH (e.g. /root/.npm-global/bin)
ensure_npm_global_path() {
  local npm_prefix
  npm_prefix=$(npm config get prefix 2>/dev/null || echo "")

  # If prefix is a user directory (not /usr), add its bin to PATH
  if [ -n "$npm_prefix" ] && [ "$npm_prefix" != "/usr" ] && [ -d "$npm_prefix/bin" ]; then
    if ! echo "$PATH" | grep -q "$npm_prefix/bin"; then
      export PATH="$npm_prefix/bin:$PATH"
    fi
  fi

  # Also ensure ~/.local/bin is in PATH (for wrapper scripts)
  if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
    export PATH="$HOME/.local/bin:$PATH"
  fi

  # Persist both paths to shell rc
  local shell_rc=""
  if [ -n "${BASH_VERSION:-}" ]; then shell_rc="$HOME/.bashrc"
  elif [ -n "${ZSH_VERSION:-}" ]; then shell_rc="$HOME/.zshrc"
  fi

  if [ -n "$shell_rc" ]; then
    if [ -n "$npm_prefix" ] && [ "$npm_prefix" != "/usr" ] && [ -d "$npm_prefix/bin" ]; then
      if ! grep -q "$npm_prefix/bin" "$shell_rc" 2>/dev/null; then
        echo "export PATH=\"$npm_prefix/bin:\$PATH\"" >> "$shell_rc"
      fi
    fi
    if ! grep -q ".local/bin" "$shell_rc" 2>/dev/null; then
      echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$shell_rc"
    fi
  fi
}

# Check/install Node.js 22+
ensure_node() {
  if command -v node &>/dev/null; then
    local node_version
    node_version=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -ge 22 ]; then
      ok "Node.js $(node -v) detected"
      return
    fi
    warn "Node.js $(node -v) found but >= 22 required"
  fi

  info "Installing Node.js 22..."
  local os pkg_manager
  os=$(detect_os)
  pkg_manager=$(detect_pkg_manager)

  case "$pkg_manager" in
    apt)
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo apt-get install -y nodejs
      ;;
    dnf|yum)
      curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
      sudo "$pkg_manager" install -y nodejs
      ;;
    apk)
      sudo apk add nodejs npm
      ;;
    brew)
      if ! command -v brew &>/dev/null; then
        info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      fi
      brew install node@22
      ;;
    *)
      err "Cannot auto-install Node.js. Please install Node.js 22+ manually."
      exit 1
      ;;
  esac

  ok "Node.js $(node -v) installed"
}

# Check/install Git
ensure_git() {
  if command -v git &>/dev/null; then
    ok "Git $(git --version | awk '{print $3}') detected"
    return
  fi

  info "Installing Git..."
  local pkg_manager
  pkg_manager=$(detect_pkg_manager)

  case "$pkg_manager" in
    apt)     sudo apt-get install -y git ;;
    dnf|yum) sudo "$pkg_manager" install -y git ;;
    apk)     sudo apk add git ;;
    brew)    brew install git ;;
    *)       err "Cannot auto-install Git."; exit 1 ;;
  esac

  ok "Git installed"
}

# Install Guiguzi via npm
install_guiguzi() {
  info "Installing Guiguzi..."

  # Try npm first
  if npm install -g "$NPM_PACKAGE@latest" 2>/dev/null; then
    ok "Guiguzi installed via npm"
    return
  fi

  # If npm fails with 404 (not published yet), install from source
  local npm_log="$HOME/.npm/_logs"
  if ls "$npm_log"/*404* &>/dev/null 2>&1 || ls "$npm_log"/*E404* &>/dev/null 2>&1; then
    warn "Package not on npm yet, installing from source..."
  else
    warn "npm install failed, trying user prefix..."
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global"
    export PATH="$HOME/.npm-global/bin:$PATH"
    if npm install -g "$NPM_PACKAGE@latest" 2>/dev/null; then
      ok "Guiguzi installed to ~/.npm-global"
      return
    fi
    warn "npm install still failed, falling back to source install..."
  fi

  # Install from GitHub source
  local src_dir="$HOME/.guiguzi/src"
  if [ -d "$src_dir/guiguzi" ]; then
    info "Updating existing source..."
    cd "$src_dir/guiguzi" && git pull --ff-only
  else
    info "Cloning from GitHub..."
    mkdir -p "$src_dir"
    git clone --depth 1 "$REPO_URL" "$src_dir/guiguzi"
    cd "$src_dir/guiguzi"
  fi

  # Install pnpm and build
  if ! command -v pnpm &>/dev/null; then
    info "Installing pnpm..."
    npm install -g pnpm
    # Refresh PATH after pnpm install
    ensure_npm_global_path
  fi
  pnpm install --frozen-lockfile
  pnpm build

  # Create wrapper script (use quoted heredoc to prevent $0 expansion)
  mkdir -p "$HOME/.local/bin"
  cat > "$HOME/.local/bin/guiguzi" << 'GUIGUZI_WRAPPER'
#!/usr/bin/env bash
GUIGUZI_ROOT="$HOME/.guiguzi/src/guiguzi"
export NODE_PATH="$GUIGUZI_ROOT/node_modules"
exec node "$GUIGUZI_ROOT/packages/nova-cli/dist/index.js" "$@"
GUIGUZI_WRAPPER
  chmod +x "$HOME/.local/bin/guiguzi"

  ok "Guiguzi installed from source at $src_dir/guiguzi"
}

# Post-install
post_install() {
  info "Running post-install checks..."

  # Reload shell config so PATH changes take effect immediately
  if [ -f "$HOME/.bashrc" ]; then
    # shellcheck disable=SC1091
    . "$HOME/.bashrc" 2>/dev/null || true
  fi

  ensure_npm_global_path

  if command -v guiguzi &>/dev/null; then
    ok "guiguzi command available"
    guiguzi doctor 2>/dev/null || true
  else
    warn "guiguzi command not found in current shell"
    info "Run: source ~/.bashrc  (or open a new terminal)"
  fi
}

# Main
main() {
  echo ""
  echo -e "${CYAN}╔═══════════════════════════════════╗${NC}"
  echo -e "${CYAN}║     Guiguzi Installer v${VERSION}    ║${NC}"
  echo -e "${CYAN}╚═══════════════════════════════════╝${NC}"
  echo ""

  local os
  os=$(detect_os)
  info "Detected OS: $os"

  ensure_node
  ensure_git
  ensure_npm_global_path
  install_guiguzi
  post_install

  echo ""
  ok "Installation complete!"
  info "Next steps:"
  info "  guiguzi onboard    - Interactive setup wizard"
  info "  guiguzi models     - List available AI models"
  info "  guiguzi console    - Start web UI (http://IP:3000)"
  info "  guiguzi agent      - Start terminal coding agent"
  echo ""
}

main "$@"
