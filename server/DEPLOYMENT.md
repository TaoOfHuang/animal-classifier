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
nano .env   # 编辑 API_TOKEN、AI_BASE_URL 等
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
npm ci --omit=dev
npm run build

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

# API Token（保护 /api/recognize 接口）
# 生成随机 token: openssl rand -hex 32
API_TOKEN=your-random-token-here

# AI 提供商配置
AI_PROVIDER=ollama
AI_BASE_URL=http://192.168.5.3:1234
AI_API_KEY=
AI_MODEL=qwen/qwen3.6-35b-a3b

# 每日调用限制（0 = 不限制）
AI_RECOGNIZE_DAILY_LIMIT=100

# 其他 API 密钥（可选）
IUCN_API_TOKEN=
UNSPLASH_ACCESS_KEY=owXiMjCjNG-o2Ebr5R6vNqgmW9iM8a5oMIFYix1L44o
PEXELS_API_KEY=
```

### 前端 `src/services/api.ts`

```typescript
// 填入与服务端 .env 中相同的 API_TOKEN
export const API_TOKEN = 'your-random-token-here';
```

> ⚠️ **安全提醒**：`.env` 文件永远不要提交到 Git！`.env.example` 是安全的模板。

---

## 常见问题

### Q: 如何生成安全的 API Token？

```bash
openssl rand -hex 32
# 输出示例: a1b2c3d4e5f6...
```

### Q: 服务器内存不足怎么办？

Docker 方案中已设置 `--max-memory-restart 500M`，PM2 会自动在内存超限时重启。

### Q: 如何查看服务日志？

```bash
# Docker
docker compose logs -f api

# PM2
pm2 logs animal-api
```

### Q: 如何回滚到上一个版本？

```bash
# Docker
docker compose pull && docker compose up -d

# PM2
pm2 restart animal-api
```

### Q: 腾讯云安全组打不开端口？

登录 [腾讯云控制台](https://console.cloud.tencent.com/) → 云服务器 → 找到你的实例 → 安全组 → 添加入站规则：

| 类型 | 端口 | 协议 | 来源 | 策略 |
|------|------|------|------|------|
| 自定义 | 3000 | TCP | 0.0.0.0/0 | 允许 |

如果使用了 Nginx，只需开放 80/443 端口。
