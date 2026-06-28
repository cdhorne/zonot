#!/bin/sh
# Zonot CLI installer (ADR-0023). Downloads the standalone single binary for your
# platform from GitHub Releases — no Bun/Node required. Usage:
#   curl -fsSL https://raw.githubusercontent.com/cdhorne/zonot/main/install.sh | sh
#
# Override: ZONOT_VERSION=v1.2.3 (default: latest) · ZONOT_BIN_DIR=~/.local/bin
set -eu

REPO="cdhorne/zonot"
VERSION="${ZONOT_VERSION:-latest}"
BIN_DIR="${ZONOT_BIN_DIR:-/usr/local/bin}"

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Linux) os="linux" ;;
  Darwin) os="darwin" ;;
  *) echo "zonot: unsupported OS '$os' — use a Windows binary from the Releases page" >&2; exit 1 ;;
esac
case "$arch" in
  x86_64 | amd64) arch="x64" ;;
  arm64 | aarch64) arch="arm64" ;;
  *) echo "zonot: unsupported architecture '$arch'" >&2; exit 1 ;;
esac

asset="zonot-${os}-${arch}"
if [ "$VERSION" = "latest" ]; then
  base="https://github.com/${REPO}/releases/latest/download"
else
  base="https://github.com/${REPO}/releases/download/${VERSION}"
fi

tmp="$(mktemp)"
echo "zonot: downloading ${asset} (${VERSION})…"
curl -fSL --progress-bar "${base}/${asset}" -o "$tmp"

# Verify the SHA-256 against the published checksums (supply-chain trust, ADR-0001).
sums="$(mktemp)"
if curl -fsSL "${base}/checksums.txt" -o "$sums"; then
  expected="$(awk -v a="$asset" '$2 == a {print $1}' "$sums")"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$tmp" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "$tmp" | awk '{print $1}')"
  fi
  if [ -n "$expected" ] && [ "$expected" != "$actual" ]; then
    echo "zonot: checksum mismatch for ${asset} — refusing to install" >&2
    exit 1
  fi
fi
chmod +x "$tmp"

# Install without sudo when BIN_DIR isn't writable.
if [ -w "$BIN_DIR" ] || [ "$(id -u)" = "0" ]; then
  mv "$tmp" "${BIN_DIR}/zonot"
else
  echo "zonot: ${BIN_DIR} is not writable; using sudo (set ZONOT_BIN_DIR=~/.local/bin to avoid)"
  sudo mv "$tmp" "${BIN_DIR}/zonot"
fi

echo "zonot: installed to ${BIN_DIR}/zonot"
"${BIN_DIR}/zonot" --version
