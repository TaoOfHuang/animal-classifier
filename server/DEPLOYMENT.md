# Animal Classifier Server — 部署指南

本文档介绍如何将后端服务部署到腾讯云服务器。

---

## 目录

1. [方案概览](#方案概览)
2. [方案一：Docker 部署（推荐）](#方案一docker-部署推荐)
3. [方案二：PM2 直接部署](#方案二pm2-直接部署)
4. [方案三：CI/CD 自动部署](#方案三cicd-自动部署)
5. [Nginx 反向代理](#nginx-反向代理)
6. [环境变量配置](#环境变量配置)
7. [常见问题](#常见问题)

---

## 方案概览

| 方案 | 适用场景 | 复杂度 | 推荐度 |
|------|---------|--------|--------|
| **Docker** | 生产环境，需要隔离和可重复部署 | 中 | ⭐⭐⭐⭐⭐ |
| **PM2** | 快速上手，轻量级部署 | 低 | ⭐⭐⭐⭐ |
| **CI/CD** | 团队开发，自动化发布 | 高 | ⭐⭐⭐ |

---

## 方案一：Docker 部署（推荐）

### 前置条件

在腾讯云服务器上安装 Docker：

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash -s docker

# 启动 Docker 并设置开机自启
sudo systemctl enable docker
sudo systemctl start docker

# 将当前用户加入 docker 组（避免每次 sudo）
sudo usermod -aG docker $USER
# 重新登录生效
```

### 部署步骤

```bash
# 1. 登录腾讯云服务器
ssh root@你的服务器IP

# 2. 创建项目目录
mkdir -p ~/animal-classifier-server
cd ~/animal-classifier-server

# 3. 从本地上传代码（在本地执行）
rsync -avz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='__tests__' \
  server/ root@你的服务器IP:~/animal-classifier-server/

# 4. 在服务器上配置 .env 文件
cp .env.example .env
nano .env   # 编辑 ADMIN_TOKEN、AI_BASE_URL 等
```

### 启动服务

```bash
# 构建并启动（首次）
docker compose up -d --build

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f api

# 停止服务
docker compose down

# 更新后重启
docker compose up -d --build
```

### 服务器防火墙

```bash
# 腾讯云安全组需要放行端口 3000（或 80/443 如果用了 Nginx）
# 登录腾讯云服务器控制台 → 云服务器 → 安全组 → 添加入站规则
# 端口范围: 3000, 协议: TCP, 来源: 0.0.0.0/0
```

---

## 方案二：PM2 直接部署

### 前置条件

```bash
# 登录服务器后执行
ssh root@你的服务器IP

# 安装 Node.js 20（使用 fnm）
curl -fsSL https://fnm.vercel.app/install | bash -s -- --yes
export PATH="$HOME/.fnm:$PATH"
eval "$(fnm env)"
fnm install 20
fnm use 20

# 验证
node -v   # v20.x.x
npm -v
```

### 部署步骤

```bash
# 1. 上传代码（在本地执行）
rsync -avz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='__tests__' \
  server/ root@你的服务器IP:~/animal-classifier-server/

# 2. 登录服务器，进入项目目录
cd ~/animal-classifier-server

# 3. 安装依赖 + 构建
# build 需要 typescript 等 devDependencies，必须先装全量依赖
npm ci
npm run build
# 构建完成后再移除开发依赖
npm prune --omit=dev

# 4. 配置 .env
cp .env.example .env
nano .env
```

### 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/index.js --name animal-api --max-memory-restart 500M

# 查看状态
pm2 status

# 查看日志
pm2 logs animal-api

# 设置开机自启
pm2 startup
pm2 save
```

### 一键部署脚本

在项目本地执行（首次需要配置 SSH 免密登录）：

```bash
# 在本地项目根目录执行
bash server/deploy.sh root@你的服务器IP
```

---

## 方案三：CI/CD 自动部署

### 配置 GitHub Secrets

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 说明 |
|------------|------|
| `SERVER_USER` | 服务器登录用户，如 `root` |
| `SERVER_IP` | 服务器公网 IP |
| `SERVER_SSH_KEY` | SSH 私钥（用于 scp/ssh） |

生成 SSH 密钥（如果还没有）：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key
# 将公钥添加到服务器：
cat ~/.ssh/deploy_key.pub | ssh root@服务器IP 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'
```

### 触发条件

当 `server/` 目录有代码推送到 `main` 或 `master` 分支时，自动：

1. 安装依赖
2. 运行测试
3. 构建项目
4. 部署到服务器并重启服务

---

## Nginx 反向代理

如果你有自己的域名或使用 HTTPS，建议配置 Nginx 反向代理。

### 安装 Nginx

```bash
sudo apt update && sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 配置

```bash
# 将 nginx.conf 复制到 Nginx 配置目录
sudo cp server/nginx.conf /etc/nginx/sites-available/animal-api

# 创建软链接启用
sudo ln -s /etc/nginx/sites-available/animal-api /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 域名和 HTTPS（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书（将 your-domain.com 替换为你的域名）
sudo certbot --nginx -d your-domain.com

# Certbot 会自动修改 Nginx 配置，重载即可
sudo systemctl reload nginx
```

---

## 环境变量配置

### `.env` 文件（服务器端）

```bash
# 端口
PORT=3000

# ── 设备令牌鉴权 ──────────────────────────────────────────────────
# 已取代原先的共享 API_TOKEN。客户端首次启动会调 POST /api/auth/device
# 用 deviceId 换取设备令牌，**服务端无需预置任何客户端密钥**。
# 设计见 docs/plans/2026-09-18-device-token-auth.md

# SQLite 数据库文件路径（Docker 部署时务必挂载卷，否则重启后设备与用量全丢）
DB_PATH=./data/app.sqlite

# 管理员令牌：仅用于 POST /api/auth/revoke 封禁设备
# 生成随机 token: openssl rand -hex 32。留空则该端点返回 503，不会裸奔。
ADMIN_TOKEN=your-random-admin-token-here

# AI 提供商配置
AI_PROVIDER=ollama
AI_BASE_URL=http://192.168.5.8:1234
AI_API_KEY=
AI_MODEL=qwen/qwen3.6-35b-a3b

# ── 三层限额（0 = 不限制）─────────────────────────────────────────
# ① 单设备每日上限 —— 公平分配，一台设备刷不爆别人
DEVICE_DAILY_LIMIT=20
# ② 全局每日上限 —— 财务保险丝，所有非白名单设备共享。
#    这是唯一不依赖客户端可信度的机制，也是本方案真正的安全边界。
GLOBAL_DAILY_LIMIT=500
# ③ 注册节流与设备总量 —— 抬高「变出新身份」的成本
REGISTER_RATE_LIMIT_PER_HOUR=3
MAX_DEVICE_COUNT=2000
# 管理员设备白名单（不参与全局配额），多个 deviceId 逗号分隔
WHITELIST_DEVICE_IDS=

# 濒危信息数据源：static（本地离线数据集，默认）| iucn_v4（在线 v4 API，需下方 token）
# 默认 static 的原因见 docs/plans/2026-09-13-itis-iucn-integration.md「前置决策 1」（IUCN ToU 限制）
# 注意：填了非法值会让服务直接启动失败（fail fast），不会静默退回默认值
CONSERVATION_SOURCE=static

# IUCN v4 token —— 仅 CONSERVATION_SOURCE=iucn_v4 时需要
# 为空时启动期只打印告警，不阻断启动（聚合层会把单个物种的失败降级掉）
# v3 已于 2025-03-27 下线且官方明确账号不迁移，需到 api.iucnredlist.org 重新注册
IUCN_API_TOKEN=

# ITIS 无需 token（公开端点）

# 图片源（可选）
UNSPLASH_ACCESS_KEY=your-unsplash-access-key
PEXELS_API_KEY=
```

> 分类信息（ITIS）与濒危信息（IUCN）的接口契约实测记录见
> `server/src/services/conservation/README.md`。

### 前端令牌获取

客户端**不再需要填写任何密钥**。`src/services/deviceAuth.ts` 会在首次请求时自动：

1. 读取系统级设备标识（Android 8+ 为 `ANDROID_ID`，清应用数据 / 卸载重装均不变）
2. 调 `POST /api/auth/device` 换取设备令牌
3. 存入 AsyncStorage，后续请求自动携带

服务端把配额与封禁都挂在 deviceId 上，因此**清掉本地令牌后重新注册不会重置当日用量**，
被封禁的设备重新注册也会被拒绝。

> ⚠️ **安全提醒**：`.env` 文件永远不要提交到 Git！`.env.example` 是安全的模板。

---

## 常见问题

### Q: 如何生成安全的 ADMIN_TOKEN？

```bash
openssl rand -hex 32
# 输出示例: a1b2c3d4e5f6...
```

该令牌**只**用于封禁设备，与客户端无关。客户端不需要任何预置密钥——
设备令牌由客户端启动时向服务端注册换取。

### Q: 如何封禁一台乱刷的设备？

```bash
curl -X POST https://你的域名/api/auth/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<16~64 位十六进制>"}'
```

deviceId 可从服务端日志中看到（查找 `+ registered new device <deviceId>`）。
被封禁的设备再调用接口会收到 403 `DEVICE_REVOKED`，且**重新注册也会被拒绝**。

### Q: 今天配额被吃掉多少？

```bash
curl https://你的域名/health
# → { "status": "ok", ..., "quota": { "date": "2026-09-18", "used": 137, "limit": 500 } }
```

### Q: 服务器内存不足怎么办？

- **PM2 方案**：`deploy.sh` / `setup-server.sh` 启动服务时已带 `--max-memory-restart 500M`，内存超限时 PM2 会自动重启进程。
- **Docker 方案**：`docker-compose.yml` 默认**没有**内存限制（`--max-memory-restart` 是 PM2 的参数，对 Docker 无效）。需要限制的话，在 `api` 服务下手动加：

```yaml
services:
  api:
    # ... 其他配置
    mem_limit: 500m
    # 软限制（可选，达到后容器进入限速状态）
    mem_reservation: 256m
```

修改后执行 `docker compose up -d` 生效。注意 Docker 是硬限制（超限会被 OOM kill 后按 `restart` 策略重启），不像 PM2 那样平滑重启。

### Q: 如何查看服务日志？

```bash
# Docker
docker compose logs -f api

# PM2
pm2 logs animal-api
```

### Q: 如何回滚到上一个版本？

> 说明：Docker 方案的镜像是**本地构建**的（`build: .`），并非从仓库拉取，所以 `docker compose pull` 对本项目无效，必须切回代码版本后重新构建。

```bash
# Docker
git checkout <上一个正常的 commit>
docker compose up -d --build

# PM2
git checkout <上一个正常的 commit>
npm ci && npm run build && npm prune --omit=dev
pm2 restart animal-api
```

### Q: 腾讯云安全组打不开端口？

登录 [腾讯云控制台](https://console.cloud.tencent.com/) → 云服务器 → 找到你的实例 → 安全组 → 添加入站规则：

| 类型 | 端口 | 协议 | 来源 | 策略 |
|------|------|------|------|------|
| 自定义 | 3000 | TCP | 0.0.0.0/0 | 允许 |

如果使用了 Nginx，只需开放 80/443 端口。
