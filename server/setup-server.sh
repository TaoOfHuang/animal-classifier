#!/usr/bin/env bash
# ── 服务器一键部署脚本 ──────────────────────────────────────────────
# 用法: bash setup-server.sh
# 目标: 在腾讯云服务器上完成 Node.js 环境、PM2、项目部署

set -euo pipefail

# ── 颜色输出 ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── 检查 Node.js ────────────────────────────────────────────────────
check_node() {
  if command -v node &>/dev/null; then
    local version
    version=$(node -v 2>/dev/null | sed 's/v//')
    local major="${version%%.*}"
    if [ "$major" -ge 18 ]; then
      log_info "Node.js $version 已安装"
      return 0
    fi
  fi
  return 1
}

# ── 安装 Node.js 20 (via fnm) ───────────────────────────────────────
install_node() {
  log_info "正在安装 Node.js 20..."
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --yes
  export PATH="$HOME/.fnm:$PATH"
  eval "$(fnm env)"
  fnm install 20
  fnm use 20
}

# ── 安装 PM2 ─────────────────────────────────────────────────────────
install_pm2() {
  if command -v pm2 &>/dev/null; then
    log_info "PM2 已安装"
    return 0
  fi
  log_info "正在安装 PM2..."
  npm install -g pm2
}

# ── 主流程 ──────────────────────────────────────────────────────────
main() {
  local server_dir
  server_dir="$(cd "$(dirname "$0")" && pwd)"

  log_info "============================================"
  log_info "  Animal Classifier Server 部署"
  log_info "  服务器目录: $server_dir"
  log_info "============================================"

  # 1. Node.js
  if ! check_node; then
    install_node
  fi

  # 2. PM2
  install_pm2

  # 3. 安装依赖
  log_info "正在安装项目依赖..."
  cd "$server_dir"
  # build 需要 typescript 等 devDependencies,先装全量依赖
  npm ci

  # 4. 构建
  log_info "正在构建项目..."
  npm run build

  # 构建完成后移除开发依赖,减小生产环境体积
  log_info "正在移除开发依赖..."
  npm prune --omit=dev

  # 5. 检查 .env
  if [ ! -f .env ]; then
    log_warn ".env 文件不存在，从 .env.example 创建..."
    cp .env.example .env
    log_warn "请编辑 .env 文件，设置 API_TOKEN 等敏感信息！"
  fi

  # 6. 用 PM2 启动
  log_info "正在使用 PM2 启动服务..."
  pm2 delete animal-api 2>/dev/null || true

  pm2 start dist/index.js \
    --name animal-api \
    --max-memory-restart 500M \
    --env-file .env

  pm2 save
  pm2 startup

  log_info "============================================"
  log_info "  部署完成！"
  log_info "  查看状态: pm2 status"
  log_info "  查看日志: pm2 logs animal-api"
  log_info "  重启服务: pm2 restart animal-api"
  log_info "  停止服务: pm2 stop animal-api"
  log_info "============================================"
}

main "$@"
