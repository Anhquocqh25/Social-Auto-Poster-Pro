#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$SCRIPT_DIR"
RELEASE_DIR="$REPO_ROOT/release"
FINAL_DIR="$REPO_ROOT/release/final"
MIN_NODE_MAJOR=20

log() {
  printf '[build-release] %s\n' "$1"
}

fail() {
  printf '[build-release] LỖI: %s\n' "$1" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Không tìm thấy lệnh '$cmd'. Hãy cài đặt trước khi build release."
}

detect_repo_root() {
  if [[ ! -f "$REPO_ROOT/package.json" || ! -d "$REPO_ROOT/src" || ! -d "$REPO_ROOT/electron" ]]; then
    fail "Không xác định được thư mục gốc của dự án. Hãy chạy script này từ bên trong repository social-auto-poster-pro."
  fi
}

check_node_version() {
  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]")" || fail "Không đọc được phiên bản Node.js."
  if (( node_major < MIN_NODE_MAJOR )); then
    fail "Node.js hiện tại không được hỗ trợ. Yêu cầu Node.js >= ${MIN_NODE_MAJOR}. Phiên bản hiện tại: $(node -v)"
  fi
}

prepare_release_dir() {
  mkdir -p "$FINAL_DIR"
  find "$FINAL_DIR" -mindepth 1 -maxdepth 1 -type f -delete
}

install_dependencies() {
  log "Đang chạy npm ci..."
  npm ci || fail "npm ci thất bại."
}

generate_prisma_client() {
  log "Đang tạo Prisma Client..."
  npx prisma generate || fail "Không thể tạo Prisma Client."
}

run_typecheck() {
  log "Đang kiểm tra TypeScript..."
  npx tsc --noEmit || fail "TypeScript kiểm tra thất bại."
}

run_build() {
  log "Đang build ứng dụng và đóng gói Electron cho Linux..."
  npm run build || fail "Build/packaging thất bại."
}

collect_artifacts() {
  log "Đang thu thập artifact cuối cùng..."
  local found=0
  shopt -s nullglob
  for artifact in "$RELEASE_DIR"/*.AppImage "$RELEASE_DIR"/*.snap; do
    [[ -f "$artifact" ]] || continue
    cp -f "$artifact" "$FINAL_DIR/" || fail "Không thể sao chép artifact $(basename "$artifact") vào release/final."
    found=1
  done
  shopt -u nullglob

  (( found == 1 )) || fail "Không tìm thấy artifact Linux đã cấu hình (.AppImage hoặc .snap) trong thư mục release."
}

verify_final_artifacts() {
  log "Đang xác minh artifact cuối cùng..."
  shopt -s nullglob
  local artifacts=("$FINAL_DIR"/*.AppImage "$FINAL_DIR"/*.snap)
  shopt -u nullglob

  (( ${#artifacts[@]} > 0 )) || fail "release/final chưa chứa artifact nào sau bước thu thập."

  for artifact in "${artifacts[@]}"; do
    [[ -f "$artifact" ]] || continue
    local name size
    name="$(basename "$artifact")"
    size="$(stat -c '%s' "$artifact")"
    printf '[build-release] ARTIFACT: %s | PATH: %s | SIZE_BYTES: %s\n' "$name" "$artifact" "$size"

    if command -v unzip >/dev/null 2>&1 && [[ "$artifact" == *.AppImage ]]; then
      if unzip -l "$artifact" 2>/dev/null | grep -Eq '(^|/)\.env\.local$|(^|/)dev\.db$'; then
        fail "Artifact $name có chứa .env.local hoặc dev.db, không an toàn để phát hành."
      fi
    fi
  done
}

generate_checksums() {
  log "Đang tạo checksum SHA256..."
  (
    cd "$FINAL_DIR"
    shopt -s nullglob
    local artifacts=( *.AppImage *.snap )
    shopt -u nullglob
    (( ${#artifacts[@]} > 0 )) || fail "Không có artifact để tạo checksum."
    sha256sum "${artifacts[@]}" > SHA256SUMS.txt
  )
  [[ -f "$FINAL_DIR/SHA256SUMS.txt" ]] || fail "Không thể tạo file checksum."
}

main() {
  cd "$REPO_ROOT"
  detect_repo_root
  require_command node
  require_command npm
  require_command sha256sum
  check_node_version
  prepare_release_dir
  install_dependencies
  generate_prisma_client
  run_typecheck
  run_build
  collect_artifacts
  verify_final_artifacts
  generate_checksums
  log "Hoàn tất build release. Artifact cuối cùng nằm trong release/final."
}

main "$@"