#!/usr/bin/env bash
# ── 本地构建 + 远程部署脚本 ─────────────────────────────────────────
# 用法: bash deploy.sh <server-user>@<server-ip>
# 示例: bash deploy.sh root@1.2.3.4

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── 参数检查 ─────────────────────────────────────────────────────────
if [ $# -lt 1 ]; then
  echo "用法: bash deploy.sh <server-user>@<server-ip>"
  echo "示例: bash deploy.sh root@1.2.3.4"
  exit 1
fi

SERVER_USER="${1%%@*}"
SERVER_IP="${1#*@}"
if [ "$SERVER_USER" = "$SERVER_IP" ]; then
  log_error "格式错误: 请使用 user@ip 格式"
  exit 1
fi

SERVER_DIR="/home/${SERVER_USER}/animal-classifier-server"
LOCAL_SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"

log_info "============================================"
log_info "  部署目标: ${SERVER_USER}@${SERVER_IP}"
log_info "  远程目录: ${SERVER_DIR}"
log_info "============================================"

# 1. 本地构建
log_info "Step 1/4: 本地构建..."
cd "$LOCAL_SERVER_DIR"
npm ci --omit=dev
npm run build

# 2.  rsync 上传（排除 node_modules 和 dist）
log_info "Step 2/4: 上传文件到服务器..."
rsync -avz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='__tests__' \
  -e "ssh -o StrictHostKeyChecking=accept-new" \
  "$LOCAL_SERVER_DIR"/ \
  "${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/"

# 3. 远程安装 + 启动
log_info "Step 3/4: 远程安装依赖并启动..."
ssh -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_IP}" <<'REMOTE_SCRIPT'
  set -e
  cd /home/${SERVER_USER}/animal-classifier-server

  # 检查并安装 Node.js
  if ! command -v node &>/dev/null || [ "$(node -v 2>/dev/null | cut -d. -f1 | tr -d v)" -lt 18 ]; then
    echo "Installing Node.js 20..."
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --yes
    export PATH="$HOME/.fnm:$PATH"
    eval "$(fnm env)"
    fnm install 20
    fnm use 20
  fi

  # 安装 PM2
  if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
  fi

  # 安装依赖 + 构建
  npm ci --omit=dev
  npm run build

  # 启动服务
  pm2 delete animal-api 2>/dev/null || true
  pm2 start dist/index.js \
    --name animal-api \
    --max-memory-restart 500M

  pm2 save
  pm2 startup

  echo ""
  echo "============================================"
  echo "  部署完成！"
  echo "  查看状态: pm2 status"
  echo "  查看日志: pm2 logs animal-api"
  echo "============================================"
REMOTE_SCRIPT

# 4. 验证
log_info "Step 4/4: 验证服务..."
sleep 3
if curl -sf "http://${SERVER_IP}:3000/health" >/dev/null 2>&1; then
  log_info "健康检查通过！http://${SERVER_IP}:3000/health"
else
  log_warn "健康检查未通过，请检查日志: ssh ${SERVER_USER}@${SERVER_IP} 'pm2 logs animal-api'"
fi

log_info "部署完成！"
