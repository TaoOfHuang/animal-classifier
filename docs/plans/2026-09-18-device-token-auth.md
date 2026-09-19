# 设备令牌鉴权改造方案

> 日期：2026-09-18
> 状态：**已实施**（2026-09-18）。实施过程中与初版方案有四处偏差，见文末「实施记录」。
> 关联：`server/src/middleware/auth.ts`、`server/src/config.ts`、`src/services/api.ts`、`docs/02-deploy-to-tencent-cloud.md`

## 一、背景：现状与问题

当前 `/api/recognize` 的防护完全依赖一个**全局共享的静态 token**，且限额是**全局计数**。

| 现状 | 代码位置 | 问题 |
|------|---------|------|
| 所有客户端共用一个 token | `src/services/api.ts` 的 `API_TOKEN` | release 包中明文可提取；一旦泄露**无法单独撤销**某台设备 |
| 服务端全等比较 | `server/src/middleware/auth.ts:43` | 没有身份概念，无法归因"是谁在用" |
| 每日限流是全局计数，不分设备 | `server/src/middleware/auth.ts:7,56` | 一个客户端刷满 100 次，**所有正常用户当天全部 429** |
| 计数只存内存 | `server/src/middleware/auth.ts:7` | 进程重启即归零，限额形同虚设 |
| 无持久化层 | `server/package.json` 仅 express/cors/dotenv/zod | 没有地方记录设备与用量 |

第 3、4 条比"token 被反编译"更容易真实发生：不需要谁去逆向，只要有一个爬虫盯上接口，全部用户就一起瘫痪。

## 二、目标与非目标

### 目标

1. **可撤销** —— 单台设备出问题，封它一个，不影响其他人
2. **可限流** —— 每设备独立配额，一台刷不爆全局
3. **可归因** —— 日志与数据库能回答"哪个设备用了多少次"
4. **财务封顶** —— 无论来多少设备，每日 AI 调用总量有硬上限

### 非目标（重要）

**本方案不追求"杜绝白嫖"，因为纯客户端方案做不到。**

任何下发到客户端的凭证都能被提取，任何客户端上报的身份都能被伪造。因此本方案的定位是：**把攻击成本从"一行 curl"抬高到"改签名重打包"，同时保证损失有硬上限**。真正的安全边界只有一条——服务端的全局日限额。

## 三、威胁模型

| 攻击手段 | 成本 | 是否被防住 | 依赖哪一层 |
|---------|------|-----------|-----------|
| 直接 `curl` 接口（无 token） | 极低 | 防住 | 设备令牌校验 |
| 反编译 APK 提取 token | 低 | 部分（token 可撤销、可按设备限额） | 设备令牌 + 单设备配额 |
| 清应用数据后重新注册 | 极低 | **防住** | deviceId 取自系统（ANDROID_ID），不随清数据变化 |
| 卸载重装（同签名） | 低 | **防住** | 同上 |
| 用已封禁设备重新注册 | 低 | **防住** | 注册接口检查 `revoked_at` |
| 改签名重新打包 | 中 | 防不住，但成本显著提高 | 全局日限额兜底 |
| 换设备 / 批量模拟器 | 中 | 防不住 | 注册节流 + 全局日限额兜底 |

### 关键设计推论

**deviceId 是身份，token 只是钥匙。** 服务端记账的主体必须是 `deviceId`：

- 只换 token（保留 deviceId）→ 服务端认得出是同一台设备 → **配额与封禁原样保留**
- 换掉 deviceId → 服务端只能当作新设备 → 单设备限额被重置，但**全局限额依然生效**

## 四、数据层设计（SQLite）

当前服务端没有任何持久化，需先引入。

### 选型：Node 内置 `node:sqlite`

使用 Node 22 内置的 `node:sqlite`（`DatabaseSync`），**不引入任何第三方依赖**。

| 对比项 | `node:sqlite`（采用） | `better-sqlite3` |
|--------|---------------------|------------------|
| 依赖 | 无 | 需安装 + 编译原生模块 |
| 类型声明 | 随 `@types/node` 提供（本项目 22.19.15 已含 `sqlite.d.ts`） | 需额外装 `@types/better-sqlite3` |
| Node 版本要求 | >= 22.5（本项目 `engines` 已声明 >= 22.11，满足） | 无特殊要求 |
| 风险 | API 标记实验性，Node 小版本升级可能变动 | 稳定 |

采用内置模块的另一个原因：本机 npm 指向私有 CodeArtifact 源且认证已失效（`E401`），第三方包安装受阻；内置模块完全绕开该问题。

> **约束**：部署机 Node 必须 >= 22.5。若将来降级到 Node 20，`node:sqlite` 不可用，届时需换回 `better-sqlite3`——改动集中在 `server/src/db/index.ts` 一个文件，其余代码无需调整。
> 启动时会打印一条 `ExperimentalWarning: SQLite is an experimental feature`，属预期输出。

### 表结构

```sql
-- 设备与令牌。token 只存哈希，明文绝不落库
CREATE TABLE IF NOT EXISTS devices (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id    TEXT    NOT NULL UNIQUE,
  token_hash   TEXT    NOT NULL,              -- sha256(token) 的十六进制
  whitelisted  INTEGER NOT NULL DEFAULT 0,    -- 1 = 不参与全局配额（管理员设备）
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at   INTEGER                        -- 非空 = 已封禁
);
CREATE INDEX IF NOT EXISTS idx_devices_token_hash ON devices (token_hash);

-- 按设备的每日用量
CREATE TABLE IF NOT EXISTS usage_daily (
  device_row_id INTEGER NOT NULL,             -- 指向 devices.id
  day           TEXT    NOT NULL,             -- YYYY-MM-DD (UTC)
  calls         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_row_id, day)
);

-- 全局每日用量：财务保险丝
CREATE TABLE IF NOT EXISTS global_usage (
  day   TEXT    PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0
);

-- 注册节流：按 IP 统计注册次数
CREATE TABLE IF NOT EXISTS register_log (
  ip         TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_register_log_ip_time ON register_log (ip, created_at);
```

### 设计要点

- **只存 `sha256(token)`**：数据库文件泄露也无法直接拿去调接口。校验时把请求 token 哈希后按 `token_hash` 查。
- **配额不落库，只以配置为准**：`devices` 表刻意**不存** `daily_limit`。配额属于配置（`DEVICE_DAILY_LIMIT`），每次请求都从环境变量读取，因此**改了配置立即对所有已注册设备生效**——紧急收紧额度时无需手动 UPDATE 全表。全局配额同理。（若将来需要给单台设备定制配额，再加一个可空字段并让空值回退到配置值即可。）
- **`whitelisted`**：避免全局配额耗尽时把自己也挡在门外（调试场景）。
- **时间统一用 UTC 的 `YYYY-MM-DD`**，与现有 `auth.ts` 的 `getTodayKey()` 保持一致。
- **数据库文件默认路径** `server/data/app.sqlite`，需纳入备份与 Docker 卷挂载。
- 测试使用 `:memory:`，互不污染。

## 五、接口设计

### 状态码语义

核心原则：**让客户端能区分「可以自愈」和「不可自愈」**，否则会陷入重试死循环。

| 情况 | 状态码 | `error.code` | 客户端行为 |
|------|--------|-------------|-----------|
| 未提供 token / 格式错误 | **401** | `UNAUTHORIZED` | 静默注册一次后重试 |
| token 查不到（伪造 / 已轮换） | **401** | `UNAUTHORIZED` | 清本地令牌 → 重新注册 |
| token 有效，但设备已封禁 | **403** | `DEVICE_REVOKED` | **停止重试**，提示服务不可用 |
| 超过单设备日配额 | **429** | `DEVICE_QUOTA_EXCEEDED` | 提示"今日次数已用完"，**禁止重新注册** |
| 超过全局日配额 | **429** | `GLOBAL_QUOTA_EXCEEDED` | 提示"服务繁忙"，**禁止重新注册** |

两者都带 `Retry-After` 响应头。全局配额选用 429（而非 503）是为了与现有实现保持一致，靠 `error.code` 区分。

> **硬约束：客户端只能因 401 重新注册，绝不能因 429 重新注册。**
> 否则"换身份重置配额"就成了官方支持的绕过路径。

### `POST /api/auth/device`（公开）

注册设备并换取令牌。

```
Request:  { "deviceId": "<16~64 位十六进制>" }
Response: { "success": true, "data": { "token": "<64 位十六进制>", "dailyLimit": 20 } }
```

服务端逻辑：

```
1. 校验 deviceId 格式（长度 16~64，字符集 [0-9a-fA-F-]），非法 → 400
2. 注册节流：同一 IP 在 1 小时内注册次数超过阈值 → 429 REGISTER_RATE_LIMITED
3. 查询 devices：
   ├─ 已存在且 revoked_at 非空 → 403 DEVICE_REVOKED（不签发任何令牌）
   ├─ 已存在且未封禁       → 保留其当日用量，轮换并签发新令牌
   └─ 不存在               → 新建设备（受全局设备总数上限约束）
4. 返回明文 token（仅此一次）
```

**封禁检查必须放在签发之前**，否则被封设备重新注册即可复活，整个封禁机制形同虚设。

### `POST /api/auth/revoke`（需鉴权，管理员使用）

```
Request:  { "deviceId": "..." }   // 可同时携带 reason 便于审计
Response: { "success": true, "data": { "revoked": true } }
```

写入 `revoked_at`。走管理员令牌鉴权（`ADMIN_TOKEN` 环境变量），不复用设备令牌。

## 六、三层限额

| 层 | 存储 | 作用 | 默认值 |
|----|------|------|--------|
| 单设备日限额 | `DEVICE_DAILY_LIMIT` + `usage_daily` | **公平分配**：一台设备刷不爆别人 | 20 / 天 |
| 全局日限额 | `global_usage` | **财务保险**：不关心来多少设备，一天就花这么多 | 500 / 天（按 AI 成本调整） |
| 注册节流 | `register_log` | 抬高"变出新身份"的成本 | 同 IP 3 次/小时，设备总数上限 2000 |

第 2 层是**唯一不依赖任何客户端可信度**的机制。

## 七、服务端改造点

| 文件 | 动作 |
|------|------|
| `server/src/db/index.ts` | 新增。打开 SQLite、执行建表、导出实例（**唯一依赖具体驱动的文件**） |
| `server/src/services/deviceService.ts` | 新增。注册、令牌校验、配额记账、封禁、注册节流 |
| `server/src/routes/auth.ts` | 新增。`POST /device`、`POST /revoke` |
| `server/src/routes/index.ts` | 挂载 `authRouter` |
| `server/src/middleware/auth.ts` | 改写：共享 token 全等比较 → 设备令牌校验；全局计数 → 按设备 + 全局双层记账；保留 `req.dailyCallsRemaining` 与 `X-Daily-Calls-Remaining` 头 |
| `server/src/config.ts` | 扩展：设备配额、全局限额、注册节流阈值、DB 路径、管理员令牌 |
| `server/package.json` | **无需新增依赖**（使用 Node 内置 `node:sqlite`） |
| `server/.env.example` | 新增配置项说明 |
| `server/src/__tests__/auth.test.ts` | 改写为设备令牌场景 |
| `server/src/services/__tests__/deviceService.test.ts` | 新增 |

> **本次不做兼容过渡**：目前尚无分发包，直接切换。旧 `API_TOKEN` 从代码与配置中移除。

## 八、App 端改造点

| 文件 | 动作 |
|------|------|
| `src/services/apiConfig.ts` | 新增。抽出 `API_BASE_URL`，打破 api ↔ deviceAuth 的循环依赖 |
| `src/services/deviceAuth.ts` | 新增。取稳定设备标识、注册换令牌、持久化、失败降级 |
| `src/services/api.ts` | 改造。令牌改为运行时获取；401 触发一次静默重注册；**429/403 不做任何重试** |
| `src/services/recognitionService.ts` | 同步改用 `requestJson`，不再自行拼 fetch 与 Authorization |
| `package.json` | 新增依赖 `react-native-device-info` |
| `jest.setup.js` | 全局把 `deviceAuth` mock 成固定令牌；其真实逻辑由 `deviceAuth.test.ts` 用 `requireActual` 单独覆盖 |

### 设备标识获取

```ts
import DeviceInfo from 'react-native-device-info';
// Android 8.0+ 返回 ANDROID_ID：按「签名 + 用户 + 设备」生成
// 清应用数据、卸载重装（同签名）均不变，无需权限
const deviceId = await DeviceInfo.getUniqueId();
```

**降级策略**：若原生模块不可用（如测试环境、未链接），退回本地随机 UUID 并打印告警。此时清数据即可绕过单设备限额——**这是明确的已知降级**，需在日志里显式标注。

### 令牌存储

复用现有 `storageService`（AsyncStorage）。虽然 Android 上 AsyncStorage 未加密，但因令牌可撤销，风险等级低于不可撤销的密钥，暂不引入 Keychain 依赖。

> 注意：`clearAllCache()` 会清掉令牌，属可接受行为——401 时自动重新注册，且**配额与封禁状态由服务端按 deviceId 保留**。

## 九、配置项

```bash
# ── 设备令牌鉴权 ──────────────────────────────────────────────────
# SQLite 数据库文件路径
DB_PATH=./data/app.sqlite

# 管理员令牌：用于 POST /api/auth/revoke，请用 openssl rand -hex 32 生成
ADMIN_TOKEN=

# ── 三层限额 ──────────────────────────────────────────────────────
# 单设备每日识别上限（0 = 不限）
DEVICE_DAILY_LIMIT=20

# 全局每日识别上限（0 = 不限）—— 财务保险丝，所有设备共享
GLOBAL_DAILY_LIMIT=500

# 注册节流：同一 IP 每小时最多注册次数
REGISTER_RATE_LIMIT_PER_HOUR=3

# 设备总数上限（0 = 不限）
MAX_DEVICE_COUNT=2000

# 管理员设备白名单：不参与全局配额，多个 deviceId 用逗号分隔
WHITELIST_DEVICE_IDS=
```

原 `AI_RECOGNIZE_DAILY_LIMIT` 由 `DEVICE_DAILY_LIMIT` 取代。

## 十、测试计划

### 服务端

`auth.test.ts` 改写，覆盖：

- 无 token → 401 / `UNAUTHORIZED`
- 伪造 token → 401
- 合法 token → 200，且返回 `X-Daily-Calls-Remaining`
- 达到设备配额 → 429 / `DEVICE_QUOTA_EXCEEDED`
- 达到全局配额 → 429 / `GLOBAL_QUOTA_EXCEEDED`
- **已封禁设备的合法 token → 403 / `DEVICE_REVOKED`**

`deviceService.test.ts` 新增，覆盖：

- 注册成功后返回的 token 能通过校验
- 同一 deviceId 重复注册**不重置当日用量**（核心不变式）
- 已封禁 deviceId 重新注册 → 403，且不签发令牌
- 超过注册节流阈值 → 拒绝
- 白名单设备不消耗全局配额
- 非法 deviceId 格式 → 拒绝

测试使用 `:memory:` 数据库，每例前重建。

### App 端

`deviceAuth` 的注册与降级逻辑加单测（mock fetch 与 DeviceInfo）。

## 十一、回退方式

因为本次不含兼容过渡，回退依赖代码层面：

1. `server/src/middleware/auth.ts` 的鉴权分支保留在 Git 中，回退 commit 即可恢复共享 token 模式
2. DB 文件独立于代码，回退代码后可保留不删（不影响运行）
3. 因为尚无分发包，**回退不会导致任何已安装客户端失效**——这正是现在做这件事成本最低的原因

## 十二、实施顺序

1. 数据层与设备服务（可独立测试）
2. 鉴权中间件改写 + auth 路由 + 配置项
3. 服务端测试补齐，全绿
4. App 端设备令牌接入
5. 全量验证（前后端 typecheck + 测试）
6. 更新 `docs/02-deploy-to-tencent-cloud.md` 的鉴权与限流章节

---

## 十三、实施记录（2026-09-18）

### 与初版方案的四处偏差

| # | 初版方案 | 实际实施 | 原因 |
|---|---------|---------|------|
| 1 | 数据层用 `better-sqlite3` | 改用 Node 22 内置 `node:sqlite`（`DatabaseSync`） | 本机 npm 指向私有 CodeArtifact 源且认证失效（`E401`），第三方包装不上。内置模块零依赖，完全绕开。**连带影响**：`Dockerfile` 基础镜像从 `node:20-alpine` 升到 `node:22-alpine`（`node:sqlite` 需 Node ≥ 22.5） |
| 2 | `devices` 表存 `daily_limit` 字段 | **删掉该字段**，配额每次从 `getDeviceDailyLimit()` 读配置 | 实施中发现测试失败：把限额固化进表后，改 `DEVICE_DAILY_LIMIT` 对**已注册设备不生效**，紧急收紧额度必须手动 UPDATE 全表。改为"配置即真相"后，改 env 立即对所有设备生效。方案第四节「配额不落库，只以配置为准」一节即为此补写的 |
| 3 | App 端 `deviceAuth.ts` 用 `await import('react-native-device-info')` 动态导入 | 改为**静态 import** + `try/catch` 兜底 | Jest 的 VM 不支持动态 import，报 `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`。静态导入后由 `jest.setup.js` 全局 mock，原生模块未链接时靠 `try/catch` 降级，行为不变 |
| 4 | 未规划 App 端 `jest.setup.js` 的 mock 策略 | 全局 mock `deviceAuth` 返回固定令牌 `test-device-token` | 否则每个既有测试都要先跑一遍注册流程。`deviceAuth` 的**真实逻辑**由 `deviceAuth.test.ts` 用 `jest.requireActual` 单独覆盖，避免 mock 掩盖真实缺陷 |

### 实际改动文件清单

**服务端（新增）**

| 文件 | 说明 |
|------|------|
| `server/src/db/index.ts` | SQLite 封装：建 4 张表、`getDb()` / `closeDb()`、支持 `:memory:` |
| `server/src/services/deviceService.ts` | `registerDevice` / `authenticateAndConsume` / `revokeDevice` / `getGlobalUsage` |
| `server/src/routes/auth.ts` | `POST /api/auth/device`（公开）、`POST /api/auth/revoke`（`ADMIN_TOKEN`，常数时间比较） |
| `server/jest.setup.js` | 测试环境设 `DB_PATH=:memory:` |

**服务端（修改）**：`middleware/auth.ts`（重写）、`config.ts`、`routes/index.ts`、`app.ts`（`/health` 加 `quota`）、`index.ts`（启动前预建表）、`.env.example`、`jest.config.js`、`Dockerfile`、`docker-compose.yml`（`DB_PATH` + `animal-data` 卷）、`package.json`（`engines`）、`.dockerignore`、`setup-server.sh`

**App（新增）**

| 文件 | 说明 |
|------|------|
| `src/services/apiConfig.ts` | 仅导出 `API_BASE_URL`，打破 `api` ↔ `deviceAuth` 循环依赖 |
| `src/services/deviceAuth.ts` | 稳定设备标识、注册换令牌、持久化、降级告警 |

**App（修改）**：`src/services/api.ts`（运行时取令牌 + `requestWithRecovery`）、`recognitionService.ts`、`jest.setup.js`、`package.json`（`react-native-device-info`）

**测试（新增/重写）**：`server/__tests__/auth.test.ts`、`server/services/__tests__/deviceService.test.ts`、`server/__tests__/recognizeRoute.test.ts`、`src/services/__tests__/deviceAuth.test.ts`、`src/services/__tests__/api.test.ts`、`src/services/__tests__/searchService.test.ts`

**文档**：`server/DEPLOYMENT.md`、`docs/02-deploy-to-tencent-cloud.md`、`docs/03-android-build-and-run.md`、`DEVELOPMENT.md` 全面移除旧 `API_TOKEN` / `AI_RECOGNIZE_DAILY_LIMIT`

### 验证结果

| 项目 | 结果 |
|------|------|
| App 测试 | 14 套件 / 175 用例 全绿 |
| Server 测试 | 18 套件 / 189 用例 全绿 |
| TypeScript | 双端 `tsc --noEmit` 无错 |
| ESLint | 22 个 error 全部落在既有 `screens/*.tsx`，与本次改动无关（`api.ts` 仅 1 个既有 warning），未处理 |

### 遗留事项

1. **必做**：`src/services/apiConfig.ts` 的 `PROD_API_BASE_URL` 仍是占位符 `https://api.example.com`，部署 server 后必须替换为真实 HTTPS 域名——它是**编译期内联进 release bundle** 的，打包后无法通过改配置修正。
2. **建议**：`ADMIN_TOKEN` 上线前用 `openssl rand -hex 32` 生成，不要用默认空值。
3. **提示**：服务端启动会打印 `ExperimentalWarning: SQLite is an experimental feature`，属预期输出，可在 PM2 / systemd 日志过滤。
4. 若将来部署机降级到 Node 20，需把 `server/src/db/index.ts` 换回 `better-sqlite3`，其余文件无需改动。
5. **已知环境噪声（非代码问题，未处理）**：在带 `HTTP_PROXY` 的受限环境里反复跑 server 测试，偶发（约 1/10 次）出现 `Parse Error: Expected HTTP/, RTSP/ or ICE/`，或 supertest 收到 `404 Mapping api/recognize not found` / `403 Forbidden`——这些响应体不是本项目 `notFoundHandler` 的 JSON 格式，即请求被本机代理截走了，与鉴权逻辑无关。已用 600 次连发的诊断用例复现并确认特征，本机（无代理）连跑 6 次全绿。若在 CI 里碰到，给 runner 设 `NO_PROXY=127.0.0.1,localhost` 或清掉 `HTTP_PROXY` 即可。
