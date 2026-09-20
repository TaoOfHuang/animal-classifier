# Animal Classifier Server — 部署指南

本文档介绍如何将后端服务部署到腾讯云服务器。

---

## 目录

1. [方案概览](#方案概览)
2. [方案一：Docker 部署（推荐）](#方案一docker-部署推荐)
3. [方案二：PM2 直接部署](#方案二pm2-直接部署)
4. [方案三：CI/CD 自动部署](#方案三cicd-自动部署)
5. [Nginx 反向代理（HTTP 80）](#nginx-反向代理http-80)
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
# 走 Nginx（推荐）：当前明文 HTTP 方案只放行 80
# 登录腾讯云服务器控制台 → 云服务器 → 安全组 → 添加入站规则
# 端口范围: 80, 协议: TCP, 来源: 0.0.0.0/0
# （以后升级 HTTPS 时再补一条 443）

# ⚠️ 不要对外开放 3000。3000 是明文 HTTP 且不校验来源，
#    直接暴露等于把设备令牌放到公网上裸传；只允许 Nginx 从本机访问它。
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

## Nginx 反向代理（HTTP 80）

当前形态是**明文 HTTP 走 80 端口**：Nginx 监听 80，把 `/api/` 与 `/health`
转给本机 3000 的 Express。配套的客户端设置是：

| 位置 | 取值 |
|------|------|
| `src/services/apiConfig.ts` | `PROD_API_BASE_URL = 'http://62.234.190.216'`（不写端口即 80） |
| `android/app/build.gradle` | release 块的 `usesCleartextTraffic = true` |

> ⚠️ **这是过渡方案，不能上架。** 设备令牌（Bearer Token）全程明文过链路，
> 可被嗅探或中间人截获；国内主流应用商店与 Google Play 对明文传输敏感数据普遍不予通过。
> 正式发版前按本章末尾「升级到 HTTPS」改造。

> ⚠️ 别让后端自己去监听 80/443。Node 开 443 只是把明文 HTTP 换了个端口：
> TLS 握手会失败（对端收到的是 `HTTP/1.1 400 Bad Request`），
> 客户端只会拿到 `TypeError: Network request failed`，排查时极具误导性。

### 0. 先把后端关回本机 3000

```bash
# server/.env（服务器上那份）
PORT=3000        # ← 不要填 80 / 443，80 留给 Nginx

pm2 restart animal-api      # 方案二（PM2）
# 或 docker compose up -d   # 方案一（Docker）
```

### 安装 Nginx

```bash
sudo apt update && sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 配置

```bash
# 复制配置
sudo cp server/nginx.conf /etc/nginx/sites-available/animal-api

# 创建软链接启用
sudo ln -s /etc/nginx/sites-available/animal-api /etc/nginx/sites-enabled/

# ⚠️ 关键一步：删掉 nginx 自带默认站点。
#    它占着 80 的 default_server，你的配置就形同不存在
#    （实测表现：/health 和 /api/* 全部 404，根路径返回 nginx 欢迎页）。
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置（若报 duplicate default server，就是上面这步没做干净）
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 验证反代真的生效

```bash
# ① 走完整链路（HTTP 80 + 反代 + Express），应返回真实 JSON
curl -s http://62.234.190.216/health

# ② 确认 80 上已经不是 nginx 默认站点
curl -s -i http://62.234.190.216/ | head -5
#    返回欢迎页 → 默认站点没删干净，回到上一步

# ③ 用手机浏览器打开 http://62.234.190.216/health 也应能看到 JSON；
#    看不到就是安全组没放行 80
```

### 升级到 HTTPS（正式发版前做）

前置条件：域名已完成 ICP 备案（大陆机房）+ DNS 解析到本机。
裸 IP 走不通——Let's Encrypt 不为 IP 签发证书；自签证书在 Android 7+ 的正式包
里默认不被信任（项目也没配 `network_security_config`），握手必然失败。

```bash
# 1. 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. 只签证书，不让 certbot 改配置（配置以仓库里的 nginx.conf 为准）
#    your-domain.com 要和 nginx.conf 里的 server_name 保持一致
sudo certbot certonly --nginx -d your-domain.com

# 3. 按 server/nginx.conf 末尾「升级到 HTTPS」的步骤改配置：
#    80 只做 301 跳转并保留 ACME 校验路径，另起 443 ssl 的 server 块
sudo nginx -t && sudo systemctl reload nginx

# 4. 续期由 systemd timer 自动完成；演练一次确认没问题
sudo certbot renew --dry-run
```

客户端两处必须同步改回，否则 release 包还在走明文：

```ts
// src/services/apiConfig.ts
const PROD_API_BASE_URL = 'https://your-domain.com';
```

```gradle
// android/app/build.gradle → buildTypes.release
manifestPlaceholders = [usesCleartextTraffic: false]
```

改完**必须重新打包**——这两个值都是编译期写死的，装到手机上的旧包改不动。

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
| 自定义 | 80 | TCP | 0.0.0.0/0 | 允许 |

当前是明文 HTTP 方案，只需要开放 80——**不要**再把 3000 暴露到公网。
以后升级 HTTPS 时，再补一条 443 的入站规则。

### Q: release 包识别一直卡住，日志报 `TypeError: Network request failed`？

这个报错是 `fetch` 把所有底层 IO 失败归一化的结果，本身不含任何线索。按顺序排查：

```bash
# 1. 确认包里的后端地址（release 下 __DEV__ 恒为 false，必落到 PROD_API_BASE_URL）
#    src/services/apiConfig.ts 应为 http://62.234.190.216（当前明文方案，不写端口即 80）

# 2. 客户端有没有放行明文 —— 当前方案下最常见的失败原因
#    android/app/build.gradle 的 release 块里 usesCleartextTraffic 必须是 true。
#    若为 false，请求会在 okhttp 层被系统直接拦掉，
#    报错和「网络不通」长得一模一样，只能靠这一步区分。

# 3. 服务器 80 通不通、反代有没有生效
curl -s http://62.234.190.216/health
#   返回 Express 的 JSON → 链路正常
#   404 / nginx 欢迎页   → 默认站点还在，见「Nginx 反向代理」配置一节
#   连接超时            → 安全组没放行 80

# 4. 确认 80 上不是别的服务占着
curl -s -i http://62.234.190.216/ | head -5
```

升级到 HTTPS 之后，第 2 步要反过来查：`usesCleartextTraffic` 必须是 `false`、
`PROD_API_BASE_URL` 必须是 `https://<域名>`；再用
`openssl s_client -connect <域名>:443 </dev/null` 确认证书链完整
（缺中间证书时浏览器可能容忍，Android 不会）。

客户端侧还有一条辅助线索：失败日志现在会带上目标地址，
`adb logcat | grep "Recognition failed"` 就能看到 `API_BASE_URL=...`。
