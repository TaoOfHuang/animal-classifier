# 缓存持久化方案（方案 C）设计稿

> **状态：未实施 · 待决策**
> 提出日期：2026-09-18
> 前置：方案 B（`withCache` 过期条目失败兜底）**已实施**，见 `server/src/utils/cache.ts`
> 关联：`docs/plans/2026-09-13-itis-iucn-integration.md`、`DEVELOPMENT.md`（分类树子节点小节）

---

## 1. 为什么会有这个方案

### 1.1 触发场景

React Native 端展开分类树某个节点时，Metro 控制台出现：

```
[api] fetchTaxonomyChildren failed for /api/taxonomy/genus/felis/children?limit=5&offset=0,
falling back to local data: Taxonomy service unavailable
```

### 1.2 完整链路上的断点

前端 `TreeNode` 懒加载 → `GET /api/taxonomy/genus/:name/children` → 服务端 `getTaxonomyChildren`
→ `resolveTaxon` 依次请求 ITIS 的 `searchByScientificName` / `getFullHierarchyFromTSN` /
`getHierarchyDownFromTSN` → 任一环节抛错 → route `catch` → **502 `TAXONOMY_UPSTREAM_FAILED`**
→ 前端 `logApiFallback` 打出上面那行并降级到本地 mock 数据。

2026-09-17 实测结论：

| 结论 | 依据 |
|---|---|
| 后端可达，报错来自上游 | 报错文案就是服务端 502 的 body；服务端不可达时前端文案会是 `Network request failed` |
| ITIS 延迟余量很薄 | 直连 `--noproxy '*'` 5 次采样：2.8 / 2.8 / 2.2 / 2.2 / 1.7 s，而 `DEFAULT_TIMEOUT_MS = 5000` |
| 缓存是进程内的 | `server/src/utils/cache.ts` 的 `Map`，且 loader 抛错不落缓存 → **每次重启都是冷启动** |

2026-09-18 补充实测（把上表第 2 行从"余量薄"修正为"压根不够"）：

| 结论 | 依据 |
|---|---|
| 5s 不是余量薄，是必然踩雷 | 同一端点直连重测 4 次：**4.2 / 4.5 / 4.0 / 9.2 s**（此前那次 1.7~2.8s 只是抽样运气） |
| 慢在 `searchByScientificName`，且取决于关键词长度 | ITIS 是**前缀匹配**：`srchKey=Felis`（单词）→ **80.6 KB / 9.44s**；`Felis catus` → 0.7 KB / 1.71s；`Panthera` → 22 KB / 3.02s。**体积差 100 倍** |
| 一次业务请求 = 3 次**串行**上游调用 | `resolveTaxon`（`search` + `getFullHierarchyFromTSN`）→ `getHierarchyDownFromTSN`；复刻链路实测 7303 + 1867 + 356 = **9527ms** |
| 502 的成因可精确复算 | `genus/ursus/children` 冷键实测 **10.31s → 502**，= `5s 超时 + 300ms 退避 + 5s 超时` |
| 与代理无关 | 把 `HTTPS_PROXY` 指向黑洞端口 `127.0.0.1:1`，Node `fetch` 仍返回 200 → **undici 不读代理环境变量**（Node 22 无 `NODE_USE_ENV_PROXY`），服务端一直是直连 |

### 1.3 方案 B 的既得收益与残留缺口

| 场景 | 方案 B（已实施） | 残留缺口 |
|---|---|---|
| 缓存期内上游抖动 | 无影响（直接命中缓存） | — |
| 缓存过期后上游抖动 | 返回过期旧值 + `[cache] … serving stale value expired Ns ago`，不再 502 | — |
| **服务重启后第一次访问** | — | 缓存为空、无旧值可兜 → **仍会直连 ITIS，仍可能 502** |

**本方案只针对最后那一行**，不解决"上游长期不可用"。
（它原先的孪生问题——上游超时太紧——已由**方案 A 于 2026-09-18 实施**：`ITIS_REQUEST.timeoutMs = 15000`，
详见 `DEVELOPMENT.md` 分类树小节。）

---

## 2. 现状基线（实施前必须了解的事实）

### 2.1 `withCache` 当前语义

1. loader 成功才写缓存；失败不写（避免固化失败结果）
2. 条目过期后**不删除**，保留用于兜底
3. loader 失败且存在未超 `staleMaxMs`（默认 7 天）的旧值 → 返回旧值并 `logger.warn`
4. 否则原样抛出（`staleIfError: false` 可显式关闭兜底）
5. `cacheStats()` 返回 `{ size, keys, stale }`，通过 `/health` 的 `cache` 字段暴露

### 2.2 缓存 key 与 TTL

| key 前缀 | 取值 | TTL | 值的类型 |
|---|---|---|---|
| `itis:search:<小写学名>` | `ItisScientificName[]` | 24h（`ITIS_TTL_MS`） | 纯 JSON |
| `itis:hier:<tsn>` | `ItisHierarchyItem[]` | 24h | 纯 JSON |
| `itis:down:<tsn>` | `ItisHierarchyItem[]` | 24h | 纯 JSON |
| `media:unsplash:<小写查询词>` | Unsplash 响应 | 24h（`UNSPLASH_TTL_MS`） | 纯 JSON |
| `iucn:taxa:<taxonKey>` / `iucn:sis:<sisId>` / `iucn:assessment:<assessmentId>` | IUCN v4 响应 | 7 天（`IUCN_TTL_MS`） | 纯 JSON |

### 2.3 可序列化性

上述值全部为 JSON 原生结构，**不含 `Date` / `Map` / `Set` / `BigInt`**（唯一的 `Set` 用法在
`taxonomyService` 内部去重，不进缓存）→ 直接 `JSON.stringify` / `JSON.parse` 往返无损，无需自定义编解码。

### 2.4 体积实测

| key | 实测响应大小 |
|---|---|
| `itis:search:felis catus` | 685 B |
| `itis:down:180586`（Felis 全部下级） | ~1.6 KB |

按每个 key 平均 1–2 KB、数百个 key 估算，**单个 JSON 文件几百 KB 量级**，无需引入 DB / Redis。

### 2.5 测试耦合面（硬约束）

`grep -rl "clearCache" server/src` = **11 个文件** = `cache.ts` 定义 + **10 个测试文件**：

`__tests__/health.test.ts`、`__tests__/searchRoute.test.ts`、`__tests__/animalRoute.test.ts`、
`__tests__/taxonomyRoute.test.ts`、`utils/__tests__/cache.test.ts`、
`services/__tests__/taxonomyService.test.ts`、`services/__tests__/animalService.test.ts`、
`services/__tests__/recognitionService.test.ts`、`services/__tests__/searchService.test.ts`、
`services/conservation/__tests__/iucnV4Provider.test.ts`

→ **持久化必须默认关闭或可注入路径**，否则跑测试会往仓库写文件，并在套件之间互相污染。
这是本方案最容易翻车的一点。

### 2.6 部署形态：**两条路线都存在，成本完全不同**

| 路线 | 入口 | 落盘影响 |
|---|---|---|
| **PM2**（`server/deploy.sh`，`docs/02-deploy-to-tencent-cloud.md` 推荐） | 本地 `npm ci && npm run build` → `rsync` 上传 → 远程 `npm ci / build / prune` → `pm2 start dist/index.js --name animal-api --max-memory-restart 500M` | 服务跑在**宿主机**，文件天然持久 → **无需 volume**。但：① `rsync` 未排除 `data/`，本地缓存会被同步到线上；② `pm2 delete` + `start` 必然重启进程（正是本方案要解决的场景） |
| **Docker**（`Dockerfile` / `docker-compose.yml`，`server/DEPLOYMENT.md` 推荐） | `docker compose up -d --build` | 容器可写层**没有挂任何 volume**，`down` / 重建镜像即丢；Dockerfile 以非 root `appuser` 运行 → **必须加 volume + 目录 chown**，否则等于白做 |

> ⚠️ 实施前必须先确认线上实际跑的是哪一条，两条路线的改动量与验收方式不同。

---

## 3. 目标与非目标

**目标**

- 服务重启后，对**此前成功查询过**的 key 仍能提供 stale 兜底 → 冷启动 502 概率显著下降
- 对现有 7 处调用方零侵入（仍然只调 `withCache`）
- 落盘失败/文件损坏**绝不影响服务可用性**

**非目标**

- 不做跨实例共享（无文件锁，本方案仅支持单实例）
- 不引入 Redis / SQLite 等外部依赖（体积不值得）
- 不做主动预热抓取（那是 C2 的范畴）
- 不替代上游超时配置：冷启动第一次遇到全新 key 时，仍会直连 ITIS（超时已由方案 A 放宽到 15s）

---

## 4. 方案 C1：全量透传持久化

### 4.1 数据结构

```ts
type Entry = { value: unknown; expiresAt: number };

type PersistedCache = {
  version: 1;                 // 结构变更时递增，不匹配即整体丢弃
  savedAt: string;            // 便于人工排查
  entries: Record<string, Entry>;
};
```

### 4.2 开关与文件位置

| 变量 | 默认 | 说明 |
|---|---|---|
| `CACHE_FILE` | `<cwd>/data/cache.json` | 指定落盘路径；设为 `off` 则**完全关闭持久化**（纯内存，等同现状） |

- 测试环境强制关闭：`process.env.NODE_ENV === 'test'` 或检测到 `JEST_WORKER_ID` 时直接 `off`，
  或由测试注入 `CACHE_FILE=<os.tmpdir()>/xxx.json`
- 目录不存在则 `mkdir -p`；无写权限 → `logger.warn` 并静默降级为纯内存
- **不要**把文件放在被 `rsync` 同步的目录里（见 4.6）

### 4.3 写入策略

- loader 成功后 **write-through + 防抖合并**（约 500 ms 内的多次写入合并成一次落盘），不阻塞请求返回
- **原子写**：先写 `<file>.tmp`，再 `fs.rename` 覆盖。禁止直接 `writeFile` 覆盖原文件
- 进程退出（`SIGINT` / `SIGTERM` / `beforeExit`）时 `flush` 一次未落盘的变更
- 任何写失败只 `warn`，不抛出（落盘是尽力而为的增强，不能反过来把请求弄挂）

### 4.4 启动加载

- 启动时同步读一次（`fs.readFileSync`，单次、几百 KB，可接受）
- `version` 不匹配 / JSON 解析失败 / 结构非法 → 把原文件改名为 `<file>.bak`，`warn`，**以空缓存启动**
- 加载时按 `staleMaxMs` 裁剪掉陈旧过久的条目
- 加载必须在 `app.listen` 之前完成，避免第一批请求看到半加载状态

### 4.5 容量与淘汰

- 条目上限 `MAX_ENTRIES`（建议 2000）：超限时优先淘汰 `expiresAt` 最早（即最陈旧）的条目
- 兜底日志沿用方案 B 的 `[cache] … serving stale value expired Ns ago`，无需新增

### 4.6 部署改动

**PM2 路线（`deploy.sh`）**

- 推荐把缓存文件放到仓库目录之外，例如 `.env` 里写
  `CACHE_FILE=/home/<user>/.animal-classifier/cache.json` —— 这样 `rsync` 天然不会碰它
- 若坚持放在 `server/data/`，则 `deploy.sh` 的 `rsync` 必须补 `--exclude='data'`，
  否则本地开发缓存会被推到线上（脏数据 + 覆盖线上更完整的缓存）

**Docker 路线**

```dockerfile
# Dockerfile：建可写目录并交给 appuser（当前以非 root appuser 运行）
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data
```

```yaml
# docker-compose.yml：命名卷（当前一个 volumes 都没有）
services:
  api:
    volumes:
      - cache-data:/app/data
volumes:
  cache-data:
```

### 4.7 测试计划（所有用例都必须在临时目录跑）

| # | 用例 |
|---|---|
| 1 | 写入后重新"启动"（新建 store 加载）→ 命中缓存，loader 不被调用 |
| 2 | 重启后 loader 失败 → 返回落盘旧值 + 告警（端到端复现本方案的收益） |
| 3 | 文件损坏 / 半截 JSON → 以空缓存启动，生成 `.bak`，不抛错 |
| 4 | `version` 不匹配 → 丢旧文件，空缓存启动 |
| 5 | 目录不可写 → 降级纯内存，进程不崩 |
| 6 | 防抖合并：连续 5 次写入只落盘 1 次 |
| 7 | `CACHE_FILE=off` → 完全不产生文件 |
| 8 | 超过 `MAX_ENTRIES` → 淘汰最陈旧条目 |
| 9 | 原子性：写入过程中断不会留下半截正式文件 |
| 10 | 现有 10 个测试套件在"默认关闭持久化"下全部照旧通过（回归） |

### 4.8 风险清单

| 风险 | 应对 |
|---|---|
| 无文件锁 → 多实例会互相覆盖 | 明确只支持单实例，写进文档；将来上多副本需换 Redis |
| 冷启动遇到**全新** key 仍可能 502 | 本方案的固有边界；超时已由方案 A 放宽（15s），残留部分需 C2 |
| 展示陈旧数据 | 已有 `stale` 日志 + `/health` 的 `cache.stale` 可观测；分类学数据本身极稳定 |
| 磁盘只读 / 权限错 / 容器未挂卷 | 全部走"warn + 降级纯内存"，绝不阻断启动 |
| 缓存文件被误提交进 Git | 加 `.gitignore`：`server/data/`（若采用默认路径） |

---

## 5. 方案 C2：内置种子快照（轻量替代）

**做法**：把常用分类节点的权威数据（如猫科 / 犬科 / 熊科 / 龟科及其属下种）固化成仓库内的
`server/src/data/taxonomySeeds.json`，服务启动时写入内存缓存（`expiresAt` 设为已过期但仍在
`staleMaxMs` 内 → 优先尝试上游、失败即用种子兜底）。

| 维度 | C2 | C1 |
|---|---|---|
| 覆盖范围 | 仅你种下的节点 | 任意查询过的 key |
| 部署改动 | **零** | 需按 4.6 改 deploy.sh 或 Docker |
| 测试影响 | **零**（只是启动预热） | 需处理 10 个测试文件的隔离 |
| 数据新鲜度 | 依赖人工更新快照 | 自动跟随上游 |
| 工作量 | 一个 JSON + 一个预热函数 | 见下节评估 |

---

## 6. 决策指引

**先判断值不值得做。** 本方案的收益集中在"服务重启后的第一次访问"：

| 场景 | 重启频率 | 痛感 |
|---|---|---|
| 本地开发（`tsx watch` 改代码即重启） | 高 | 明显 |
| 线上 PM2（`deploy.sh` 每次发版 `pm2 delete` + `start`） | 低（发版级） | 低 |
| 线上 Docker（`restart: unless-stopped`） | 极低 | 很低 |

另外注意：**UI 并不会坏**——前端本来就有 mock 兜底，分类树照常展开，那行红字只是控制台噪声。
所以本方案的实质收益是"减少噪声与不确定性"，不是"修复功能"。

**建议排序**（成本从低到高）：

1. ~~**方案 A**：给 `ITIS_REQUEST` 加 `timeoutMs: 15000`~~ —— **已于 2026-09-18 实施**。
   实测把 worst case 从"必然 502"降到"9.44s 即便最坏也留 1.6 倍余量"；代价是叠加 `retries: 1` 后
   单次上游调用**最坏 30.3s 才放弃**（要缩短可把 `ITIS_REQUEST.retries` 降为 0）
2. **方案 C2**：零部署风险、零测试影响，覆盖你实际会点的那些节点
3. **方案 C1**：确认了线上部署路线、且能接受改 Docker/PM2 配置之后再做

**规模评估（C1）**：`cache.ts` 改造 +60~90 行、持久化模块 +80~120 行（仅用 `node:fs`，无新依赖）、
测试 +8~12 用例约 120 行、部署改动约 7 行。合计约 300 行。

---

## 7. 验收标准（若实施）

- [ ] `npx tsc --noEmit` 0 错误；`npx jest --runInBand` 全绿（含新增用例）
- [ ] 手工验收：查一次分类树 → 重启进程 → **断开 ITIS（或改错上游地址）**再查同一节点 → 仍返回正确数据，日志出现 `serving stale value`
- [ ] `/health` 能看到 `cache.size` / `cache.stale` 随重启保留
- [ ] 删除缓存文件、写坏缓存文件、把目录设为只读 —— 三种情况服务都能正常启动
- [ ] 线上按实际路线验证：PM2 发版一次后缓存仍在；或 Docker `down/up` 后缓存仍在

---

## 8. 未决问题

1. 线上实际跑的是 **PM2 还是 Docker**？（决定 4.6 走哪一节）
2. 是否只持久化 `itis:*` 前缀（体积小、纯 JSON、最稳定），而 `iucn:*` / `media:*` 保持纯内存？
3. 缓存文件默认路径：`<cwd>/data/cache.json` 还是仓库外（如 `~/.animal-classifier/`）？
4. 是否需要在 `/health` 里暴露持久化状态（如 `cache.persisted: true/false`、文件路径、上次落盘时间）？
5. 种子快照（C2）的数据来源与更新流程如何约定（谁负责、多久刷新一次）？
