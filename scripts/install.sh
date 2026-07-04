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
  info "Installing Guiguzi via npm..."

  if npm install -g "$NPM_PACKAGE@latest" 2>/dev/null; then
    ok "Guiguzi installed via npm"
  else
    warn "Global npm install failed (EACCES?), trying user prefix..."
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global"
    export PATH="$HOME/.npm-global/bin:$PATH"
    npm install -g "$NPM_PACKAGE@latest"
    ok "Guiguzi installed to ~/.npm-global"
  fi
}

# Post-install
post_install() {
  info "Running post-install checks..."

  if command -v guiguzi &>/dev/null; then
    ok "guiguzi command available"
    guiguzi doctor 2>/dev/null || true
  else
    warn "guiguzi command not found in PATH"
    warn "You may need to restart your shell or add npm global bin to PATH"
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
  install_guiguzi
  post_install

  echo ""
  ok "Installation complete!"
  info "Run 'guiguzi onboard' to get started."
  echo ""
}

main "$@"
