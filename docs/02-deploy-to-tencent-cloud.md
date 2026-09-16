# 部署到腾讯云服务器

> 本文档说明如何把本项目的**后端服务**（`server/`，Node.js + Express + TypeScript）部署到腾讯云服务器，以及如何让 Android App 连上它。

## 一、项目结构与部署目标

| 部分 | 位置 | 说明 |
|------|------|------|
| 移动端 | 项目根目录（`src/`、`android/`） | React Native 应用，打包成 APK 分发，**不部署到服务器** |
| 后端 | `server/` | Express + TypeScript 服务，监听 3000 端口，**部署到服务器** |

后端提供的关键端点：

- `GET /health` — 健康检查，用于验证服务是否存活
- `POST /api/recognize` — 图片识别接口（需要 `API_TOKEN`）

---

## 二、三种部署方式对比

| 方式 | 适用场景 | 复杂度 | 说明 |
|------|---------|--------|------|
| **一键脚本（PM2）** | 个人项目、快速上线 | 低 | 推荐，本地一条命令完成构建 + 上传 + 启动 |
| **服务器本地初始化（PM2）** | 代码已经手动放到服务器上 | 低 | 在服务器上执行 `setup-server.sh` |
| **Docker** | 需要环境隔离、可重复部署 | 中 | 用 `Dockerfile` + `docker-compose.yml` |

---

## 三、前置准备

### 1. 购买并登录服务器

腾讯云控制台 → 云服务器 CVM。配置建议：**2 核 2G 起步**（Node 构建阶段比较吃内存）。

首次登录（本地执行）：

```bash
ssh root@你的服务器公网IP
```

### 2. 配置 SSH 免密登录（一键部署的前提）

本地执行：

```bash
ssh-copy-id root@你的服务器公网IP
```

之后 `ssh root@IP` 应无需输入密码即可登录。

### 3. 放行端口（最容易漏的一步）

登录腾讯云控制台 → 云服务器 → 找到实例 → **安全组** → 添加入站规则：

| 类型 | 端口 | 协议 | 来源 | 用途 |
|------|------|------|------|------|
| 自定义 | `3000` | TCP | `0.0.0.0/0` | 直接访问后端（开发/测试） |
| 自定义 | `80` | TCP | `0.0.0.0/0` | HTTP（走 Nginx 时需要） |
| 自定义 | `443` | TCP | `0.0.0.0/0` | HTTPS（走 Nginx 时需要） |

> 如果配置了 Nginx 反向代理，**可以只开 80/443，不必暴露 3000**，安全性更高。

---

## 四、方式一：一键部署脚本（推荐）

本地执行，一条命令完成「本地构建 → 上传 → 远程安装依赖 → 构建 → PM2 启动 → 健康检查」：

```bash
cd /path/to/AnimalClassifier
bash server/deploy.sh root@你的服务器公网IP
```

脚本流程：

1. **本地构建**：`npm ci` + `npm run build`（生成 `dist/`）
2. **上传**：`rsync` 同步到服务器 `~/animal-classifier-server`，自动排除 `node_modules`、`dist`、`.git`、`.env`、`__tests__`
3. **远程准备**：检测 Node.js ≥ 18，不满足则用 `fnm` 安装 Node 20；安装 PM2
4. **远程构建**：`npm ci` → `npm run build` → `npm prune --omit=dev`
5. **启动**：PM2 启动 `dist/index.js`，进程名 `animal-api`，限制内存 500M
6. **验证**：请求 `http://服务器IP:3000/health` 检查存活

> ⚠️ **构建依赖的坑**：`npm run build` 需要 `typescript`，而它是 `devDependency`。
> 所以必须先 `npm ci` 装全量依赖再构建，构建完再 `npm prune --omit=dev` 瘦身。
> 直接 `npm ci --omit=dev && npm run build` 会因找不到 `tsc` 而失败。

### 部署完成后必做：配置 `.env`

脚本不会上传 `.env`（安全考虑），需要在服务器上手动创建：

```bash
ssh root@你的服务器公网IP
cd ~/animal-classifier-server
cp .env.example .env
nano .env
```

配置完成后重启服务：

```bash
pm2 restart animal-api
```

---

## 五、方式二：服务器本地初始化

如果代码已经在服务器上（例如通过 Git 克隆），在服务器上执行：

```bash
cd ~/animal-classifier-server
cp .env.example .env
nano .env                      # 先配好环境变量

bash setup-server.sh
```

该脚本会依次完成：检查/安装 Node.js 20（fnm）→ 安装 PM2 → `npm ci` → `npm run build` → `npm prune --omit=dev` → PM2 启动并设置开机自启。

---

## 六、方式三：Docker 部署

Docker 方式用多阶段构建（builder 装全量依赖编译，production 阶段只装生产依赖），环境更干净。

### 安装 Docker（服务器上执行）

```bash
curl -fsSL https://get.docker.com | bash -s docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER     # 免 sudo，需重新登录生效
```

### 启动服务

```bash
cd ~/animal-classifier-server
cp .env.example .env
nano .env

docker compose up -d --build      # 构建并后台启动
docker compose ps                 # 查看状态
docker compose logs -f api        # 查看日志
docker compose down               # 停止
```

### 限制容器内存（可选）

`docker-compose.yml` 默认没有内存限制（`--max-memory-restart` 是 PM2 的参数，对 Docker 无效）。如需限制，在 `api` 服务下添加：

```yaml
services:
  api:
    # ... 其他配置
    mem_limit: 500m
    mem_reservation: 256m
```

> 注意：Docker 是**硬限制**，超限会被 OOM kill 后按 `restart` 策略重启，不像 PM2 那样平滑。

---

## 七、Nginx 反向代理与 HTTPS

配置了域名之后建议加一层 Nginx，好处是可以用 80/443 端口、上 HTTPS、隐藏后端端口。

### 安装与配置

```bash
sudo apt update && sudo apt install -y nginx
sudo systemctl enable nginx && sudo systemctl start nginx

# 复制项目自带的配置模板
sudo cp ~/animal-classifier-server/nginx.conf /etc/nginx/sites-available/animal-api
sudo ln -s /etc/nginx/sites-available/animal-api /etc/nginx/sites-enabled/

sudo nginx -t          # 测试配置语法
sudo systemctl reload nginx
```

编辑 `/etc/nginx/sites-available/animal-api`，把 `server_name` 改成你的域名。

### 申请 HTTPS 证书（Let's Encrypt，免费）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot 会自动改写 Nginx 配置并重载。证书到期前会自动续期。

---

## 八、环境变量配置（`server/.env`）

```bash
PORT=3000

# 接口鉴权 Token —— 保护 /api/recognize
# 生成方式：openssl rand -hex 32
API_TOKEN=你的随机token

# AI 提供商：openai | ollama | openrouter | custom
AI_PROVIDER=ollama

# AI 接口地址
AI_BASE_URL=http://192.168.5.8:1234/v1

# API Key（本地 Ollama 可留空）
AI_API_KEY=

# 模型名称
AI_MODEL=qwen/qwen3.6-35b-a3b

# 每日识别次数上限（0 = 不限制）
AI_RECOGNIZE_DAILY_LIMIT=100

# 第三方 API（可选）
IUCN_API_TOKEN=
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=
```

### ⚠️ 关于 `AI_BASE_URL` 的注意事项

`server/.env.example` 里默认是 `http://192.168.5.8:1234/v1`，这是**局域网内网地址**。部署到公网服务器后：

- 服务器**无法访问**这个内网 IP，识别接口会全部失败
- 上线前必须改为**公网可达的地址**，两种选择：
  1. 换成云端 AI 服务（如 OpenAI / OpenRouter 兼容接口），同时改 `AI_PROVIDER` 和 `AI_API_KEY`
  2. 把本地 Ollama 通过内网穿透/公网 IP 暴露出来（注意加访问控制）

### 安全提醒

- `.env` 含密钥，**绝不要提交到 Git**（已在 `.gitignore` 中）
- `API_TOKEN` 要与 App 端 `src/services/api.ts` 中的 `API_TOKEN` **保持一致**，否则接口会返回 401

---

## 九、让 Android App 连上服务器

App 的接口地址在 `src/services/api.ts`：

```typescript
export const API_BASE_URL = 'http://10.0.2.2:3000';
export const API_TOKEN = 'animal-classifier-xyz-123';
```

需要根据运行环境修改 `API_BASE_URL`：

| 运行环境 | `API_BASE_URL` 应填 |
|---------|---------------------|
| Android 模拟器访问**本机**后端 | `http://10.0.2.2:3000`（`10.0.2.2` 是模拟器访问宿主机 localhost 的固定地址） |
| 真机访问**本机**后端 | `http://本机局域网IP:3000`（如 `http://192.168.1.10:3000`） |
| 真机访问**线上**后端 | `http://服务器公网IP:3000` 或 `https://your-domain.com` |

> 注意：Android 默认禁止明文 HTTP。本项目在 `android/app/build.gradle` 中通过
> `manifestPlaceholders = [usesCleartextTraffic: true]` 放开了限制，所以能用 HTTP。
> 正式发布建议改为 HTTPS 域名并关闭该开关，否则部分应用市场会审核不通过。

---

## 十、日常运维

```bash
# ── PM2 方式 ──
pm2 status                    # 查看进程状态
pm2 logs animal-api           # 实时日志
pm2 logs animal-api --lines 200
pm2 restart animal-api        # 重启
pm2 stop animal-api           # 停止
pm2 monit                     # 资源监控面板

# ── Docker 方式 ──
docker compose ps
docker compose logs -f api
docker compose restart api
docker compose up -d --build  # 更新代码后重建
```

### 更新代码后重新部署

```bash
# PM2：本地重新跑一键部署即可
bash server/deploy.sh root@服务器IP

# Docker：服务器上拉取新代码后重建
git pull && docker compose up -d --build
```

### 回滚到上一个版本

```bash
# PM2
cd ~/animal-classifier-server
git checkout <上一个正常的 commit>
npm ci && npm run build && npm prune --omit=dev
pm2 restart animal-api

# Docker（镜像是本地构建的，不能 pull，需切回代码后重建）
git checkout <上一个正常的 commit>
docker compose up -d --build
```

---

## 十一、常见问题

| 现象 | 原因与解决 |
|------|-----------|
| 本地 `curl http://IP:3000/health` 不通 | ① 服务没起来，`pm2 logs` 看日志；② **安全组没放行 3000 端口**（最常见）；③ 服务器防火墙 `ufw`/`firewalld` 拦了 |
| 部署脚本停在 `npm run build` 报找不到 `tsc` | 用了 `npm ci --omit=dev`，需先装全量依赖再构建 |
| 部署脚本报 `cd: /home//animal-classifier-server: No such file` | 脚本在远程 heredoc 里引用了未展开的变量，已修复为使用 `$HOME` |
| 服务器内存不足 / 构建被 OOM kill | 低配机器构建吃力：本地构建好 `dist/` 再上传，或加 swap |
| App 请求全部失败但 `/health` 正常 | `API_BASE_URL` 配错，或 `API_TOKEN` 与服务端不一致（返回 401） |
| 识别接口报 AI 相关错误 | `AI_BASE_URL` 还是内网地址，服务器访问不到，见第八节 |
| `docker compose up` 报端口占用 | 3000 已被 PM2 占用，先 `pm2 delete animal-api` 或改用其他端口 |

---

## 十二、速查清单

上线前逐项确认：

- [ ] 服务器安全组已放行对应端口
- [ ] 本地已配置 SSH 免密登录
- [ ] 服务器上 `.env` 已创建且内容正确
- [ ] `API_TOKEN` 与 App 端 `src/services/api.ts` 一致
- [ ] `AI_BASE_URL` 是服务器可访问的地址（**不是内网 IP**）
- [ ] `pm2 status` 显示 `online` 或 `docker compose ps` 显示 `Up`
- [ ] `curl http://服务器IP:3000/health` 返回 `{"status":"ok"}`
- [ ] 配置了 HTTPS（正式发布时）
