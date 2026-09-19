# 部署到腾讯云服务器

> 本文档说明如何把本项目的**后端服务**（`server/`，Node.js + Express + TypeScript）部署到腾讯云服务器，以及如何让 Android App 连上它。

## 一、项目结构与部署目标

| 部分 | 位置 | 说明 |
|------|------|------|
| 移动端 | 项目根目录（`src/`、`android/`） | React Native 应用，打包成 APK 分发，**不部署到服务器** |
| 后端 | `server/` | Express + TypeScript 服务，监听 3000 端口，**部署到服务器** |

后端提供的关键端点：

- `GET /health` — 健康检查，验证服务是否存活，并返回当日配额消耗
- `POST /api/auth/device` — 设备注册，用 deviceId 换取设备令牌（公开）
- `POST /api/recognize` — 图片识别接口（需要设备令牌，见第九节）
- `POST /api/auth/revoke` — 封禁设备（需要 `ADMIN_TOKEN`）

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

# 设备令牌鉴权 —— 已取代原先的共享 API_TOKEN
# 客户端首次启动会调 POST /api/auth/device 换取设备令牌，服务端无需预置客户端密钥。
# 设计见 docs/plans/2026-09-18-device-token-auth.md
# SQLite 数据库文件路径（务必纳入备份；Docker 部署需挂载卷，否则重启丢数据）
DB_PATH=./data/app.sqlite

# 管理员令牌：仅用于 POST /api/auth/revoke 封禁设备
# 生成方式：openssl rand -hex 32。留空则该端点返回 503，不会裸奔。
ADMIN_TOKEN=你的随机管理员token

# AI 提供商：openai | ollama | openrouter | custom
AI_PROVIDER=ollama

# AI 接口地址
AI_BASE_URL=http://192.168.5.8:1234/v1

# API Key（本地 Ollama 可留空）
AI_API_KEY=

# 模型名称
AI_MODEL=qwen/qwen3.6-35b-a3b

# ── 三层限额（0 = 不限制）────────────────────────────────────────
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
- 客户端**不再需要任何预置密钥**：设备令牌由 App 启动时向 `POST /api/auth/device` 注册换取
- `ADMIN_TOKEN` 只用于封禁设备，**不要**写进客户端
- `data/app.sqlite` 里存的是设备与用量，**需纳入备份**（不含令牌明文，只存 sha256）

---

## 九、让 Android App 连上服务器

App 的接口地址在 `src/services/apiConfig.ts`，已按构建环境自动分流：

```typescript
const DEV_API_BASE_URL  = 'http://10.0.2.2:3000';      // debug 构建
const PROD_API_BASE_URL = 'https://api.example.com';   // release 构建 ← 部署后必须替换

export const API_BASE_URL = __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL;
```

**部署完 server 后，客户端只需要改这一件事**：把 `PROD_API_BASE_URL` 换成你的真实 HTTPS 域名。

**鉴权不用配了**：客户端不再有写死的 `API_TOKEN`。首次启动时 `src/services/deviceAuth.ts`
会自动用系统设备标识（Android 8+ 的 `ANDROID_ID`）调 `POST /api/auth/device` 换取设备令牌，
之后每次请求自动携带。设备令牌可被单独撤销、按设备限额——这是共享密钥做不到的。

| 运行环境 | 实际生效的地址 | 说明 |
|---------|---------------|------|
| debug 构建 + 模拟器 | `http://10.0.2.2:3000` | `10.0.2.2` 是模拟器访问**宿主机 localhost** 的固定地址 |
| debug 构建 + 真机 | `http://10.0.2.2:3000`（不通） | 真机会把它解析成手机自己的 localhost。用 `adb reverse tcp:3000 tcp:3000` 可解决 |
| release 构建 | `PROD_API_BASE_URL` | 运行期无法修改，地址已内联进 `index.android.bundle`，换域名必须重新打包 |

> **为什么不能「手动改一行再打包」**：`API_BASE_URL` 是编译期字面量，Metro 打包时会直接内联。
> `__DEV__` 在 release bundle 中恒为 `false`，会被静态求值——所以正式包永远落到 `PROD_API_BASE_URL`，
> 不会再出现「把 `10.0.2.2` 打进正式包」的事故。

### 明文 HTTP 与 HTTPS

`android/app/build.gradle` 里按变体分别控制 `usesCleartextTraffic`：

| 变体 | 值 | 原因 |
|------|-----|------|
| `debug` | `true` | 要访问开发机的 `http://10.0.2.2:3000` |
| `debugOptimized` | `true` | 继承 debug（AGP `initWith`），无需单独配置 |
| `release` | `false` | **强制 HTTPS**：避免 Bearer Token 明文传输，同时满足应用市场审核要求 |

因此线上后端**必须**启用 HTTPS。`PROD_API_BASE_URL` 不能填 `http://` 地址，
否则 release 包的所有请求会被系统直接拦截（表现为全部接口失败，但不弹任何提示）。

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
| App 请求全部失败但 `/health` 正常 | ① `PROD_API_BASE_URL` 还是占位符 `api.example.com`；② release 包配了 `http://` 地址 → 被 `usesCleartextTraffic=false` 拦截；③ 设备注册被注册节流拦下（429 `REGISTER_RATE_LIMITED`） |
| App 返回 403 `DEVICE_REVOKED` | 该设备已被封禁（`POST /api/auth/revoke`），需解除或换设备 |
| App 返回 429 `DEVICE_QUOTA_EXCEEDED` | 该设备当日额度用完，次日重置。**不要靠清应用数据重注册来绕过**——服务端按 deviceId 记账，重新注册不会重置用量 |
| App 返回 429 `GLOBAL_QUOTA_EXCEEDED` | 全局额度耗尽（可能有人在刷）。`curl /health` 看 `quota.used`，必要时调高 `GLOBAL_DAILY_LIMIT` 或封禁可疑设备 |
| 重启服务后配额归零 | `DB_PATH` 指向了非持久化路径。Docker 部署需把卷挂载到 `data/` |
| 识别接口报 AI 相关错误 | `AI_BASE_URL` 还是内网地址，服务器访问不到，见第八节 |
| `docker compose up` 报端口占用 | 3000 已被 PM2 占用，先 `pm2 delete animal-api` 或改用其他端口 |

---

## 十二、速查清单

上线前逐项确认：

- [ ] 服务器安全组已放行对应端口
- [ ] 本地已配置 SSH 免密登录
- [ ] 服务器上 `.env` 已创建且内容正确
- [ ] `ADMIN_TOKEN` 已生成（`openssl rand -hex 32`），且**没有**写进客户端
- [ ] `DB_PATH` 指向持久化目录（Docker 部署已挂载卷，否则重启后设备与用量丢失）
- [ ] `GLOBAL_DAILY_LIMIT` 已按自己的 AI 成本设定
- [ ] `AI_BASE_URL` 是服务器可访问的地址（**不是内网 IP**）
- [ ] `pm2 status` 显示 `online` 或 `docker compose ps` 显示 `Up`
- [ ] `curl http://服务器IP:3000/health` 返回 `{"status":"ok"}`
- [ ] 配置了 HTTPS（正式发布时）
