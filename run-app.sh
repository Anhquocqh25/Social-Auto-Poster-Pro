#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$SCRIPT_DIR"
ENV_LOCAL_PATH="$REPO_ROOT/.env.local"
ENV_EXAMPLE_PATH="$REPO_ROOT/.env.example"
PRISMA_DB_PATH="$REPO_ROOT/prisma/dev.db"
MIN_NODE_MAJOR=20

log() {
  printf '[run-app] %s\n' "$1"
}

fail() {
  printf '[run-app] LỖI: %s\n' "$1" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Không tìm thấy lệnh '$cmd'. Hãy cài đặt trước khi chạy ứng dụng."
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

ensure_dependencies() {
  if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
    log "Chưa có node_modules. Đang chạy npm ci..."
    npm ci || fail "npm ci thất bại."
  else
    log "Đã có node_modules. Bỏ qua npm ci."
  fi
}

ensure_prisma_client() {
  log "Đang tạo Prisma Client..."
  npx prisma generate || fail "Không thể tạo Prisma Client."
}

ensure_env_local() {
  if [[ -f "$ENV_LOCAL_PATH" ]]; then
    log "Đã tìm thấy .env.local. Sẽ dùng cấu hình hiện có."
    return
  fi

  if [[ ! -f "$ENV_EXAMPLE_PATH" ]]; then
    fail "Thiếu .env.local và cũng không có .env.example để tạo mẫu cấu hình."
  fi

  cp "$ENV_EXAMPLE_PATH" "$ENV_LOCAL_PATH" || fail "Không thể tạo .env.local từ .env.example."
  log "Đã tạo .env.local từ .env.example."
  log "Hãy nhập thủ công thông tin Facebook/OAuth thật vào .env.local nếu bạn cần kết nối thật."
}

ensure_safe_publish_flag() {
  if [[ ! -f "$ENV_LOCAL_PATH" ]]; then
    fail "Không tìm thấy .env.local sau bước chuẩn bị."
  fi

  if grep -Eq '^[[:space:]]*FACEBOOK_REAL_PUBLISH_ENABLED=' "$ENV_LOCAL_PATH"; then
    local current_value
    current_value="$(grep -E '^[[:space:]]*FACEBOOK_REAL_PUBLISH_ENABLED=' "$ENV_LOCAL_PATH" | tail -n 1 | cut -d '=' -f 2- | tr -d '\r' | xargs)"
    if [[ "$current_value" != "false" ]]; then
      fail "FACEBOOK_REAL_PUBLISH_ENABLED trong .env.local phải là false để chạy an toàn. Hãy đặt lại cờ này thành false rồi chạy lại."
    fi
    log "Đã xác minh FACEBOOK_REAL_PUBLISH_ENABLED=false trong .env.local."
  else
    printf '\nFACEBOOK_REAL_PUBLISH_ENABLED=false\n' >> "$ENV_LOCAL_PATH" || fail "Không thể thêm cấu hình safe mode vào .env.local."
    log "Đã thêm FACEBOOK_REAL_PUBLISH_ENABLED=false vào .env.local."
  fi

  export FACEBOOK_REAL_PUBLISH_ENABLED=false
}

ensure_dev_database() {
  if [[ -f "$PRISMA_DB_PATH" ]]; then
    log "Đã tìm thấy cơ sở dữ liệu cục bộ tại prisma/dev.db. Không ghi đè."
    return
  fi

  log "Chưa có prisma/dev.db. Đang khởi tạo cơ sở dữ liệu phát triển mới bằng prisma db push..."
  npx prisma db push --skip-generate || fail "Không thể khởi tạo cơ sở dữ liệu phát triển mới."
  [[ -f "$PRISMA_DB_PATH" ]] || fail "Prisma báo thành công nhưng prisma/dev.db chưa được tạo."
  log "Đã khởi tạo cơ sở dữ liệu phát triển mới tại prisma/dev.db."
}

start_app() {
  log "Đang khởi động ứng dụng ở chế độ phát triển an toàn..."
  npm run dev
}

main() {
  cd "$REPO_ROOT"
  detect_repo_root
  require_command node
  require_command npm
  check_node_version
  ensure_dependencies
  ensure_prisma_client
  ensure_env_local
  ensure_safe_publish_flag
  ensure_dev_database
  start_app
}

main "$@"