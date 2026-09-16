# ITIS / IUCN 集成实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 ITIS（分类信息）与 IUCN（濒危信息）从「有代码、但没接线」的占位骨架，变成真实可用、且被识别链路与详情链路真正消费的数据源；同时补齐前后端断裂的接口契约。

**Background:** `DEVELOPMENT.md` 的 Phase 3 把「ITIS API 集成 ✅ / IUCN API 集成 ✅」标记为已完成，但实际排查（2026-09-13）发现两处均为空壳，且在用户主链路上一次都没被调用。详见下方「已核实事实」。

**Architecture:** 保持现有 Express 分层（`routes` / `services` / `types` / `middleware`），新增三层：

1. **外部客户端层** — `utils/http.ts`（编码/重试/超时）与 `utils/cache.ts`（TTL 缓存），供所有外部 API 复用
2. **数据源 Provider 层** — ITIS 只负责「学名 → 分类谱系」，IUCN 只负责「学名 → 濒危评估」。IUCN 走 Provider 接口，在线（v4）与离线（本地数据集）两种实现可切换
3. **聚合层** — `services/animalService.ts` 新增 `enrichAnimal()`，把 Provider 结果合并进动物对象；`/api/recognize` 与 `/api/animal/:id` 共用它

**Tech Stack:** Node.js 22+, Express 4, TypeScript 5.7（strict）, tsx, jest + ts-jest + supertest, zod（已装但未用于本模块）

---

## 一、已核实的事实（2026-09-13 实测，不要重复调研）

| 项 | 实测结果 | 影响 |
|----|---------|------|
| ITIS `jsonservice/searchByScientificName` | HTTP 200，**接口仍可用** | 端点不必更换 |
| ITIS 响应编码 | **ISO-8859-1，非 UTF-8**。`getFullRecordFromTSN` 报文 UTF-8 解码在 offset 0xf6/0xfc 处失败 | 现有 `response.json()` 接上必崩 |
| ITIS 中文检索 | `srchKey=东北虎` → **0 命中** | 中文搜索必须前置「中文→学名」映射 |
| ITIS `getFullHierarchyFromTSN` | 可用，返回 `hierarchyList`，含 Kingdom→Subspecies 共 16 级（含 Subkingdom / Infrakingdom / Superclass / Subfamily 等冗余级） | 需白名单过滤到 7 级 |
| ITIS 俗名 | `searchByCommonName` 仅英/法/西，且噪声大（`tiger` → `tigerfishes`） | 不可作为中文名来源 |
| ITIS `getHierarchyDownFromTSN?tsn=180592` | 可用，返回 `hierarchyList`，**只含直接下级**（Panthera → 5 个 Species） | 直接支撑分类树懒加载，无需自己遍历 |
| ITIS `getFullHierarchyFromTSN` 响应结构 | 顶层 `{author, class, hierarchyList, rankName, sciName, tsn}`；单条 `{author, class, parentName, parentTsn, rankName, taxonName, tsn}` | 字段名以此为准，不是 `name`/`level` |
| IUCN `apiv3.iucnredlist.org` | **HTTP 403 —— v3 已于 2025-03-27（Red List 2025-1 更新后）下线** | 现有代码路径已死 |
| IUCN v3 → v4 账号 | 官方明确「no v3 API accounts were migrated」，**需重新注册** | 需用户去申请 token |
| IUCN v4 鉴权 | 无 token 时 `api.iucnredlist.org/api/v4/*` 返回 403 `{"error":"Forbidden"}` | 必须带 token |
| `server/.env` | `IUCN_API_TOKEN=` 为空 | `getIucnStatus()` 直接 `return 'EN'`，走不到网络 |
| IUCN ToU | 明确写明 API 面向教育/研究，**"may need to restrict access if … such as mobile app development"**，商业用途严禁 | 合规风险，见「前置决策 1」 |

## 二、代码层面的断点（本计划要修的）

| # | 断点 | 位置 |
|---|------|------|
| 1 | `/api/recognize` 只返回 `{animal, confidence}`，taxonomy 直接来自 LLM，从不调用 ITIS/IUCN | `server/src/services/recognitionService.ts:182` |
| 2 | `getTaxonomyTree()` 只取 `scientificNames[0].tsn`，再把它塞进 `parent.scientificName`（写成 `"ITIS TSN 183805"`），层级语义错误 | `server/src/services/taxonomyService.ts:48-60` |
| 3 | `getAnimalById()` 忽略 `id` 参数，恒返回硬编码东北虎 | `server/src/services/animalService.ts:83` |
| 4 | `mapIucnCategory()` 只认 CR/EN/VU/NT/LC，EX/EW/DD/NE 一律兜底成 `'EN'` | `server/src/services/animalService.ts:44-50` |
| 5 | `/api/taxonomy/:level/:id/children` 与 `/api/taxonomy/search` 两个前端必调路由**不存在** → 404 | `server/src/routes/taxonomy.ts` |
| 6 | taxonomy detail 响应结构不一致：前端期望 `{current, parent, childCount}`，服务端返回 `{current, parent, children}` | 同上 |
| 7 | **前端全线不解 `{success, data}` 信封**：`getAnimalDetail`、`fetchTaxonomyChildren`、`fetchTaxonomyDetail`、`searchTaxonomy`、`searchAnimals` 都把整个响应体当成 payload | `src/services/searchService.ts:180,310`、`src/services/taxonomyService.ts:339,412,464` |
| 8 | `fetchJsonWithTimeout` 无编码处理、无重试、无 User-Agent | `server/src/services/externalApiService.ts` |
| 9 | 无任何缓存 | — |
| 10 | 两个 service 测试只覆盖兜底分支，成功路径无 mock 测试 | `server/src/services/__tests__/` |

## 三、前置决策

> 以下 4 项无法由代码推导，已给出默认方案。**未收到你的反对意见前，计划按默认方案执行。**

1. **IUCN 数据来源（合规，最关键）** — 默认：**不把 IUCN v4 设为唯一路径**。抽象 `ConservationProvider` 接口，两个实现：`iucnV4Provider`（在线）与 `staticDatasetProvider`（本地 JSON，覆盖热门物种）。用 `CONSERVATION_SOURCE=iucn_v4 \| static` 切换，默认 `static`。这样即便 v4 token 申请不下来、或日后被判定违规，App 仍能正常工作。
   → 若你决定只用 v4，把默认值改成 `iucn_v4` 即可，其余计划不变。
2. **IUCN v4 token** — 需你去 `api.iucnredlist.org` 重新注册（v3 账号不迁移）。Phase C 的 Task C1 会先落一个「无 token 时必须优雅降级」的测试，不等 token 也能推进。
3. **分类粒度** — 默认**种级**。ITIS 谱系里若同时出现 Species 与 Subspecies，取 Species 作为 `species` 层级，亚种信息挂到 `subspecies` 附加字段（不进入 7 级枚举）。东北虎这类识别结果由 LLM 给出的三段学名会被归一化到种。
4. **中文名来源** — 默认**自建字典**（`server/src/data/taxonomyZh.ts`：界门纲目科属高频词表 + 中文别名索引），缺失时**回退显示学名**，绝不用 LLM 臆造。

## 四、验收标准

- [ ] `cd server && npm test` 全绿，且新增用例覆盖**成功路径**（mock 掉 fetch），不只是兜底
- [ ] `npx tsc --noEmit`（根目录与 `server/`）零错误
- [ ] 真实请求 `Panthera tigris` 能拿到 Kingdom→Species 的完整 7 级分类，中文名正确，不出现 `"ITIS TSN 183805"` 这类字段
- [ ] `/api/recognize` 返回体包含 **ITIS 校正过的 taxonomy** 与 **IUCN 来源的 conservationStatus**
- [ ] 断网 / 无 token / 上游 5xx 时，两个接口仍返回可用数据（降级不报错、不返回错误的濒危等级）
- [ ] 前端 5 处调用全部正确解包 `{success, data}`
- [ ] `DEVELOPMENT.md` 的 Phase 3 勾选项与事实对齐

---

# Phase A · 基础设施

### Task A1: HTTP 客户端支持非 UTF-8 响应

ITIS 返回 ISO-8859-1，`response.json()` 会在含重音字符的报文上抛错。这是所有 ITIS 工作的前置。

**Files:**

- Modify: `server/src/services/externalApiService.ts`
- Test: `server/src/services/__tests__/externalApiService.test.ts`

**Step 1: 写失败测试**

```ts
import { fetchJsonWithTimeout } from '../externalApiService';

describe('fetchJsonWithTimeout', () => {
  it('decodes ISO-8859-1 payloads when charset is latin1', async () => {
    // 0xfc = 'ü' in ISO-8859-1, invalid as UTF-8
    const bytes = Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xfc, 0x22, 0x7d]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    }) as unknown as typeof fetch;

    const data = await fetchJsonWithTimeout<{ a: string }>('https://example.test/x', undefined, {
      charset: 'latin1',
    });
    expect(data.a).toBe('ü');
  });
});
```

**Step 2: 跑测试确认失败**

Run: `cd server && npx jest externalApiService`
Expected: FAIL —— 第三个参数当前是 `timeoutMs: number`，传对象不匹配签名。

**Step 3: 实现**

把第三参数从 `timeoutMs: number` 改为可选配置对象，并保持向后兼容：

```ts
type RequestOptions = {
  timeoutMs?: number;
  charset?: 'utf-8' | 'latin1';
  retries?: number;
  headers?: Record<string, string>;
};

export const fetchJsonWithTimeout = async <T>(
  url: string,
  init?: RequestInit,
  options: RequestOptions = {},
): Promise<T> => {
  const { timeoutMs = 5000, charset = 'utf-8', retries = 0 } = options;
  // ...
  const buffer = await response.arrayBuffer();
  const text = new TextDecoder(charset === 'latin1' ? 'iso-8859-1' : 'utf-8').decode(buffer);
  return JSON.parse(text) as T;
};
```

> 注意：现有 3 处调用（`taxonomyService` / `animalService`）传的是 `number` 或不传，需同步审计并改为对象。

**Step 4: 跑测试确认通过**

Run: `cd server && npx jest externalApiService && npx tsc --noEmit`
Expected: PASS，无类型错误。

**Step 5: 提交**

```bash
git add server/src/services
git commit -m "fix(server): support non-utf8 responses in external api client"
```

---

### Task A2: 重试与退避

**Files:**

- Modify: `server/src/services/externalApiService.ts`
- Test: `server/src/services/__tests__/externalApiService.test.ts`

**Step 1: 写失败测试** — 分别断言：5xx 重试后成功；5xx 连续失败抛出；**4xx 不重试**（fetch 只被调用一次）。

**Step 2: 跑测试确认失败**

Run: `cd server && npx jest externalApiService`
Expected: FAIL —— 尚无重试逻辑。

**Step 3: 实现**

- 仅对网络错误与 5xx 重试，4xx 立即抛出（ITIS/IUCN 的 403 属于配置问题，重试无意义且浪费配额）
- 退避：`300ms`、`900ms`（`300 * 3 ** attempt`）
- 默认 `retries = 1`；IUCN 传 `retries = 2`
- 补 `User-Agent: AnimalClassifier/1.0`

**Step 4: 跑测试确认通过** — `cd server && npx jest externalApiService`

**Step 5: 提交** — `git commit -m "feat(server): add retry with backoff to external api client"`

---

### Task A3: TTL 缓存

ITIS 与 IUCN 官方都建议缓存（IUCN 按 Red List 版本更新，每年 2–3 次）。

**Files:**

- Create: `server/src/utils/cache.ts`
- Test: `server/src/utils/__tests__/cache.test.ts`

**Step 1: 写失败测试** — 命中缓存不重复调用 loader；TTL 过期后重新调用；`invalidate(prefix)` 生效。

**Step 2: 跑测试确认失败** — `cd server && npx jest cache` → FAIL（模块不存在）

**Step 3: 实现**

```ts
type Entry<T> = { value: T; expiresAt: number };
export const withCache = async <T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> => { /* Map<string, Entry<unknown>> */ };
export const invalidateCache = (prefix: string): void => { /* ... */ };
export const cacheStats = (): { size: number } => { /* 供 /health 暴露 */ };
```

TTL 常量放在 `server/src/constants/cache.ts`：`ITIS_TTL = 24h`、`IUCN_TTL = 7d`。测试中用假 timer，不要真等。

**Step 4: 跑测试确认通过** — `cd server && npx jest cache`

**Step 5: 提交** — `git commit -m "feat(server): add ttl cache utility"`

---

# Phase B · ITIS 集成（分类信息）

### Task B1: 学名检索 + 完整谱系

**Files:**

- Modify: `server/src/services/taxonomyService.ts`
- Test: `server/src/services/__tests__/taxonomyService.test.ts`（扩充现有文件）

**Step 1: 写失败测试**（mock fetch，返回真实报文切片）

```ts
it('maps itis full hierarchy to seven levels', async () => {
  mockItisHierarchy([
    { rankName: 'Kingdom',  taxonName: 'Animalia',        tsn: '202423' },
    { rankName: 'Subkingdom', taxonName: 'Bilateria',     tsn: '914154' },
    { rankName: 'Phylum',   taxonName: 'Chordata',        tsn: '158852' },
    { rankName: 'Class',    taxonName: 'Mammalia',         tsn: '179913' },
    { rankName: 'Subfamily',taxonName: 'Pantherinae',      tsn: '552364' },
    { rankName: 'Genus',    taxonName: 'Panthera',         tsn: '180592' },
    { rankName: 'Species',  taxonName: 'Panthera tigris',  tsn: '183805' },
  ]);

  const lineage = await fetchLineage('Panthera tigris');

  expect(lineage.kingdom?.scientificName).toBe('Animalia');
  expect(lineage.species?.scientificName).toBe('Panthera tigris');
  expect(lineage).not.toHaveProperty('subkingdom');
  expect(Object.keys(lineage)).toEqual(
    expect.arrayContaining(['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']),
  );
});
```

**Step 2: 跑测试确认失败**

Run: `cd server && npx jest taxonomyService`
Expected: FAIL —— `fetchLineage` 未导出。

**Step 3: 实现**

三步链路，全程 `charset: 'latin1'`：

1. `searchByScientificName?srchKey={name}` → 取 `scientificNames[0].tsn`（**优先 `combinedName` 完全匹配项**，避免前缀误命中）
2. `getFullHierarchyFromTSN?tsn={tsn}` → `hierarchyList`
3. 白名单过滤映射：

```ts
const RANK_TO_LEVEL: Record<string, TaxonomyLevel> = {
  Kingdom: 'kingdom',
  Phylum: 'phylum',
  Class: 'class',
  Order: 'order',
  Family: 'family',
  Genus: 'genus',
  Species: 'species',
};
```

丢弃 `Subkingdom` / `Infrakingdom` / `Subphylum` / `Infraphylum` / `Superclass` / `Subclass` / `Infraclass` / `Suborder` / `Subfamily` / `Subspecies`（亚种另存附加字段）。
`commonNameZh` 暂用 Task B2 的字典，取不到就回退 `scientificName`。

**同时删除**现有把 TSN 写入 `parent.scientificName` 的写法（断点 #2）。

**Step 4: 跑测试确认通过** — `cd server && npx jest taxonomyService`

**Step 5: 提交** — `git commit -m "feat(server): resolve itis full lineage into seven taxonomy levels"`

---

### Task B2: 中文名字典与中文检索索引

ITIS 无中文名，服务端目前零 latin→zh 映射（前端 `constants/taxonomy.ts` 只有界/门/纲零星几条）。

**Files:**

- Create: `server/src/data/taxonomyZh.ts`
- Create: `server/src/data/zhNameIndex.ts`
- Modify: `server/src/services/taxonomyService.ts`
- Test: `server/src/data/__tests__/taxonomyZh.test.ts`

**Step 1: 写失败测试** — 已知学名返回正确中文；未知学名**回退学名本身**（不返回空、不返回猜测）；`zhNameIndex` 能把「东北虎」映射到 `Panthera tigris`。

**Step 2: 跑测试确认失败** — `cd server && npx jest taxonomyZh` → FAIL（模块不存在）

**Step 3: 实现**

`taxonomyZh.ts`：两组数据。

- `RANK_ZH`：高频高层级词典（沿用前端已有的 `COMMON_KINGDOMS` / `COMMON_PHYLUMS` / `COMMON_CLASSES` 并扩充目/科/属），键为大写学名
- `SPECIES_ZH`：热门物种中文名表，初版覆盖 `HOT_SEARCH_ANIMALS`（大熊猫、东北虎、金丝猴、雪豹、白鳍豚、朱鹮、藏羚羊、中华鲟）+ 现有 mock 里的猫科/熊科/犬科/海龟科物种

`zhNameIndex.ts`：反向索引 `Record<string, string>`（中文名 → 学名），含别名（如「华南虎」→ `Panthera tigris`、「大猫熊」→ `Ailuropoda melanoleuca`）。

> 这份数据是**手工维护**的。请在 PR 描述里注明数据来源（ITIS 学名 + 中文维基/中国动物志常用名），便于日后校验。

**Step 4: 跑测试确认通过** — `cd server && npx jest taxonomyZh`

**Step 5: 提交** — `git commit -m "feat(server): add chinese taxonomy dictionary and name index"`

---

### Task B3: 中文入口前置解析

ITIS 不认中文（实测 0 命中），但前端搜索全程走中文。

**Files:**

- Modify: `server/src/services/taxonomyService.ts`
- Test: `server/src/services/__tests__/taxonomyService.test.ts`

**Step 1: 写失败测试**

```ts
it('resolves chinese name to scientific name before calling itis', async () => {
  const lineage = await fetchLineage('东北虎');
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('srchKey=Panthera%20tigris'),
    expect.anything(),
  );
  expect(lineage.species?.scientificName).toBe('Panthera tigris');
});
```

**Step 2: 跑测试确认失败** — `cd server && npx jest taxonomyService` → FAIL

**Step 3: 实现** — 入口处归一化：含 CJK 字符（`/[\u4e00-\u9fa5]/`）→ 查 `zhNameIndex`；命中则用学名，未命中直接返回 `null`（让上层走兜底，不要拿中文去问 ITIS 白跑一次）。

**Step 4: 跑测试确认通过** — `cd server && npx jest taxonomyService`

**Step 5: 提交** — `git commit -m "feat(server): resolve chinese common names before itis lookup"`

---

# Phase C · IUCN 集成（濒危信息）

### Task C1: Provider 接口 + 离线数据集

先立接口与离线实现，让链路不依赖 token 就能跑通（对应前置决策 1）。

**Files:**

- Create: `server/src/services/conservation/types.ts`
- Create: `server/src/services/conservation/staticProvider.ts`
- Create: `server/src/services/conservation/index.ts`
- Create: `server/src/data/conservationDataset.ts`
- Test: `server/src/services/conservation/__tests__/staticProvider.test.ts`

**Step 1: 写失败测试** — 已知物种返回完整 `ConservationStatus`；未知物种返回 `null`（**不是** 硬编码 'EN'）。

**Step 2: 跑测试确认失败** — `cd server && npx jest staticProvider` → FAIL

**Step 3: 实现**

```ts
export type ConservationStatus = {
  iucnStatus: IUCNStatus;
  population?: number;
  populationTrend?: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  assessmentYear?: number;
  threats?: string[];
  source: 'iucn_v4' | 'static';
};

export interface ConservationProvider {
  readonly name: ConservationStatus['source'];
  lookup(scientificName: string): Promise<ConservationStatus | null>;
}
```

`index.ts` 按 `process.env.CONSERVATION_SOURCE`（默认 `static`）选实现，未知值抛错（fail fast）。

**Step 4: 跑测试确认通过** — `cd server && npx jest staticProvider`

**Step 5: 提交** — `git commit -m "feat(server): add conservation provider abstraction with offline dataset"`

---

### Task C2: 修正 IUCN 等级映射（独立修复，可先行）

这是当前最危险的 bug：`EX`/`EW` 会被显示成「濒危」。

**Files:**

- Modify: `server/src/services/animalService.ts`
- Test: `server/src/services/__tests__/animalService.test.ts`

**Step 1: 写失败测试**

```ts
it.each([
  ['EX', 'EX'], ['EW', 'EW'], ['CR', 'CR'], ['EN', 'EN'], ['VU', 'VU'],
  ['NT', 'NT'], ['LC', 'LC'], ['DD', 'DD'], ['NE', 'NE'],
])('maps %s to %s', (input, expected) => {
  expect(mapIucnCategory(input)).toBe(expected);
});

it('falls back to DD instead of EN for unknown or missing category', () => {
  expect(mapIucnCategory(undefined)).toBe('DD');
  expect(mapIucnCategory('WEIRD')).toBe('DD');
});
```

**Step 2: 跑测试确认失败** — `cd server && npx jest animalService` → FAIL（`EX` 返回 `'EN'`）

**Step 3: 实现** — 映射表改为从 `src/constants/taxonomy.ts` 的 `IUCN_STATUS` 键集合派生（服务端需新增 `server/src/constants/taxonomy.ts`，与前端保持同源），未知/缺失一律 `'DD'`。**移除 `'EN'` 兜底。**

**Step 4: 跑测试确认通过** — `cd server && npx jest animalService`

**Step 5: 提交** — `git commit -m "fix(server): correct iucn category mapping and stop defaulting to EN"`

---

### Task C3: IUCN v4 Provider

**Files:**

- Create: `server/src/services/conservation/iucnV4Provider.ts`
- Test: `server/src/services/conservation/__tests__/iucnV4Provider.test.ts`

**Step 1: 先核对官方文档**（必做，不要凭记忆写字段名）

Run: `curl -s https://api.iucnredlist.org/api/v4/ | head -50`，并查阅 v4 的 swagger/说明页，确认：

- 鉴权头格式（`Authorization: <token>` 还是 `Bearer <token>`）
- 按学名查询 taxon 的确切路径与参数
- 取评估详情（`red_list_category` / population trend / assessment year）的确切路径与字段名

把结论**记录在 `server/src/services/conservation/README.md`**，避免下次重复调研。

**Step 2: 写失败测试**（mock fetch，断言两跳调用顺序与字段解析；断言未配置 token 时**抛错而非返回假数据**）

**Step 3: 跑测试确认失败** — `cd server && npx jest iucnV4Provider` → FAIL

**Step 4: 实现**

- 读 `process.env.IUCN_API_TOKEN`，为空则抛 `IucnNotConfiguredError`
- 两步调用：学名 → `assessment_id`（取 `latest: true` 的记录）→ 评估详情
- 补全 `population` / `populationTrend` / `assessmentYear` / `threats`（前端 `ConservationInfo` 早已定义这些字段，服务端此前一个都没给）
- 走 Task A1 的 `charset`、A2 的 `retries: 2`、A3 的 `withCache(IUCN_TTL)`
- 若 `assessment` 存在但字段缺失，**缺什么留空，不要填默认值**

**Step 5: 跑测试确认通过** — `cd server && npx jest iucnV4Provider`

**Step 6: 提交** — `git commit -m "feat(server): add iucn red list api v4 provider"`

---

### Task C4: 聚合入口 `enrichAnimal()`

**Files:**

- Modify: `server/src/services/animalService.ts`
- Test: `server/src/services/__tests__/animalService.test.ts`

**Step 1: 写失败测试** — ITIS 成功时 taxonomy 被校正；IUCN 失败时保留原始 taxonomy 且 `conservationStatus` 为 `undefined`（**不是假 EN**）；两个外部服务都超时时不抛异常。

**Step 2: 跑测试确认失败** — `cd server && npx jest animalService` → FAIL

**Step 3: 实现**

```ts
export const enrichAnimal = async (base: AnimalLike): Promise<AnimalLike> => {
  const [lineage, conservation] = await Promise.allSettled([
    fetchLineage(base.scientificName),
    getConservationProvider().lookup(base.scientificName),
  ]);
  // 两者各自独立降级：一方失败不影响另一方
};
```

用 `Promise.allSettled`，**任一外部依赖失败都不得让整个请求失败**。

**Step 4: 跑测试确认通过** — `cd server && npx jest animalService`

**Step 5: 提交** — `git commit -m "feat(server): aggregate itis and iucn data via enrichAnimal"`

---

# Phase D · 打通链路与接口契约

### Task D1: `/api/recognize` 接入 enrichment

这是「集成」真正的落点 —— 目前 LLM 给的分类无人校验。

**Files:**

- Modify: `server/src/services/recognitionService.ts`
- Modify: `server/src/routes/recognize.ts`（如需调整日志）
- Modify: `server/src/types/api.ts`（新增 `AnimalDetail` 等共享类型）
- Test: `server/src/services/__tests__/recognitionService.test.ts`

**Step 1: 写失败测试** — LLM 返回错误科（如把虎归到 `Ursidae`）时，**ITIS 结果覆盖 LLM 结果**；LLM 学名无法在 ITIS 查到（`getFullHierarchyFromTSN` 空）时保留 LLM 的 taxonomy；IUCN 为 `EX` 时响应里 `iucnStatus` 是 `EX` 而非 `EN`。

**Step 2: 跑测试确认失败** — `cd server && npx jest recognitionService` → FAIL

**Step 3: 实现** — `recognizeByImage()` 末尾调用 `enrichAnimal()`，响应体扩为：

```ts
{
  animal: { id, commonNameZh, commonNameEn, scientificName, taxonomy, conservationStatus? },
  confidence: number,
  dataSources: { taxonomy: 'itis' | 'llm'; conservation: 'iucn_v4' | 'static' | 'none' },
}
```

新增 `dataSources` 便于前端与排查区分「数据来自哪」。前端 `RecognitionApiResponse.data.animal` 类型是 `Partial<Animal>`，**新增字段不会破坏前端**。

**Step 4: 跑测试确认通过** — `cd server && npx jest recognitionService`

**Step 5: 提交** — `git commit -m "feat(server): enrich recognize results with itis and iucn data"`

---

### Task D2: 补齐 taxonomy 路由并对齐契约

**Files:**

- Modify: `server/src/routes/taxonomy.ts`
- Modify: `server/src/services/taxonomyService.ts`
- Test: `server/src/__tests__/taxonomyRoute.test.ts`

**Step 1: 写失败测试**

```ts
it('GET /api/taxonomy/:level/:name returns current/parent/childCount', async () => {
  const res = await request(app).get('/api/taxonomy/family/Felidae');
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual(
    expect.objectContaining({ current: expect.any(Object), childCount: expect.any(Number) }),
  );
});

it('GET /api/taxonomy/:level/:name/children returns paginated children', async () => {
  const res = await request(app).get('/api/taxonomy/genus/Panthera/children?limit=10&offset=0');
  expect(res.body.data).toEqual(
    expect.objectContaining({ children: expect.any(Array), hasMore: expect.any(Boolean), total: expect.any(Number) }),
  );
});

it('GET /api/taxonomy/search returns results', async () => {
  const res = await request(app).get('/api/taxonomy/search?q=虎');
  expect(res.body.data.results).toEqual(expect.any(Array));
});
```

**Step 2: 跑测试确认失败** — `cd server && npx jest taxonomyRoute` → FAIL（404 / 结构不符）

**Step 3: 实现**

- 新增 `GET /taxonomy/:level/:name/children` → 用 `getHierarchyDownFromTSN?tsn={tsn}`（**已实测可用，返回直接下级，正好对应懒加载语义**），拿到结果后在内存里做 `slice(offset, offset + limit)`，`total` 为返回数组长度
  - 注意：该端点返回的 `rankName` 是下级层级（Genus 的下钻返回 Species），响应里要带上，供前端校验层级连续性
- 新增 `GET /taxonomy/search` → 走 B3 的中文入口 + ITIS 检索
- `GET /taxonomy/:level/:name` 返回值去掉 `children`，改补 `childCount`，与前端期望的 `{current, parent, childCount}` 对齐（断点 #6）
- `:name` 参数需 `decodeURIComponent` 且做长度/字符白名单校验（zod），避免把任意字符串直传上游
- 缓存：`withCache('itis:down:{tsn}', ITIS_TTL)`

**Step 4: 跑测试确认通过** — `cd server && npx jest taxonomyRoute`

**Step 5: 提交** — `git commit -m "feat(server): add taxonomy children and search routes, align detail contract"`

---

### Task D3: 补齐 `/api/animal/:id` 与 search suggestions

**Files:**

- Modify: `server/src/services/animalService.ts`
- Modify: `server/src/routes/animal.ts`
- Modify: `server/src/routes/search.ts`
- Modify: `server/src/services/searchService.ts`
- Test: `server/src/__tests__/animalRoute.test.ts`、`server/src/__tests__/searchRoute.test.ts`

**Step 1: 写失败测试** — `/api/animal/Panthera%20tigris` 返回虎（不再是恒定的东北虎）；未知 id 返回 404 而非 200 假数据；`/api/search/suggestions?q=虎` 返回字符串数组。

**Step 2: 跑测试确认失败** — `cd server && npx jest animalRoute searchRoute` → FAIL

**Step 3: 实现**

- `getAnimalById(id)`：把 `id` 当学名处理（前端 `recognitionService` 已用 `animal.scientificName` 作为 `id`），查 ITIS + IUCN；查不到返回 `null`，路由层映射为 **404 `{success:false, error:{code:'ANIMAL_NOT_FOUND'}}`**
- 现有硬编码东北虎逻辑**只保留在测试 fixture 中**，不留在生产路径
- 新增 `GET /api/search/suggestions`（断点 #5 的另一半）

**Step 4: 跑测试确认通过** — `cd server && npx jest`

**Step 5: 提交** — `git commit -m "feat(server): resolve animal by scientific name and add suggestions route"`

---

# Phase E · 前端接线

### Task E1: 统一解包 `{success, data}`

断点 #7 —— 5 处调用全都把整个响应体当 payload，一旦打开开关就会得到 `results: []` / `undefined`，且**因为包在 try/catch 里会静默退回 mock**，极难发现。这必须最先修。

**Files:**

- Modify: `src/services/api.ts`
- Modify: `src/services/searchService.ts`
- Modify: `src/services/taxonomyService.ts`
- Test: `src/services/__tests__/searchService.test.ts`、`src/services/__tests__/taxonomyService.test.ts`

**Step 1: 写失败测试** — mock fetch 返回 `{success:true, data:{items:[...]}}`，断言 `searchAnimals` 返回 `results.length === 1`。

**Step 2: 跑测试确认失败** — `npm test -- src/services/__tests__/searchService.test.ts` → FAIL（`results` 为空）

**Step 3: 实现** — 在 `src/services/api.ts` 新增：

```ts
export const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const body = (await response.json()) as { success: boolean; data: T; error?: { message: string } };
  if (!body.success) throw new Error(body.error?.message || 'Request failed');
  return body.data;
};
```

5 处调用点全部改用它。**同时把 `catch (error) { console.warn(...) }` 的静默降级改为 `console.error` 并附路径**，避免同类问题再次隐身。

**Step 4: 跑测试确认通过** — `npm test -- src/services`

**Step 5: 提交** — `git commit -m "fix(app): unwrap success/data envelope in api services"`

---

### Task E2: 打开开关并把 ITIS/IUCN 数据用起来

**Files:**

- Modify: `src/services/searchService.ts`（`USE_BACKEND_API`）
- Modify: `src/services/taxonomyService.ts`（`USE_BACKEND_API`）
- Modify: `src/screens/AnimalDetailScreen.tsx`
- Test: `src/screens/__tests__/`（新增）

**Step 1: 写失败测试** — 详情页在有 `conservationStatus` 时渲染 `EndangeredBadge`；`EX` 显示「灭绝」而非「濒危」；无 `conservationStatus` 时该卡片不渲染。

**Step 2: 跑测试确认失败** — `npm test -- AnimalDetailScreen` → FAIL

**Step 3: 实现**

- 两个 `USE_BACKEND_API` 改为从集中配置读取（避免又要改两处），建议 `src/services/api.ts` 导出 `USE_BACKEND_API`
- `AnimalDetailScreen` 的 `getMockAnimalData()` 改为：**优先用 `getAnimalDetail(id)` 拉真实数据**，失败才退回本地构造。`habitat` / `lifestyle` 的硬编码长文本移入 mock 分支
- 顺手修正 `AnimalDetailScreen.tsx:156` 的 `isEndangered` 判断：目前只含 `CR/EN/VU`，`EX`/`EW` 也会被当成「不濒危」，与 `constants/taxonomy.ts` 的完整枚举不一致

**Step 4: 跑测试确认通过** — `npm test && npx tsc --noEmit`

**Step 5: 提交** — `git commit -m "feat(app): wire animal detail to backend and consume conservation data"`

---

# Phase F · 配置、测试与文档

### Task F1: 环境变量与配置校验

**Files:**

- Modify: `server/.env.example`
- Modify: `server/src/config.ts`
- Test: `server/src/__tests__/config.test.ts`

**Step 1: 写失败测试** — `CONSERVATION_SOURCE` 非法值抛错；`iucn_v4` 模式下缺 token 时启动期打印明确告警（不阻断启动）。

**Step 2–4: 实现并验证** — `.env.example` 新增并加中文注释：

```
# ITIS 无需 token
# IUCN 数据源：static（离线数据集，默认）| iucn_v4（需下方 token）
CONSERVATION_SOURCE=static
IUCN_API_TOKEN=
```

**Step 5: 提交** — `git commit -m "chore(server): document taxonomy and conservation env vars"`

---

### Task F2: 成功路径测试补齐

现有两个 service 测试**只测兜底分支**，改坏了也不会红。

**Files:**

- Modify: `server/src/services/__tests__/taxonomyService.test.ts`
- Modify: `server/src/services/__tests__/animalService.test.ts`

**Step 1–4: 实现并验证** — 用 `global.fetch = jest.fn()` 注入真实报文切片（含 ISO-8859-1 字节），覆盖：ITIS 成功、ITIS 404、ITIS 超时、IUCN 403、IUCN 无 token。断言降级行为符合 Task C4 的约定。

Run: `cd server && npm test`

**Step 5: 提交** — `git commit -m "test(server): cover external api success and failure paths"`

---

### Task F3: 文档对齐

**Files:**

- Modify: `DEVELOPMENT.md`
- Modify: `server/DEPLOYMENT.md`（如涉及新环境变量）
- Create: `server/src/services/conservation/README.md`（Task C3 产出）

**Step 1–4: 实现并核对** — 修正 Phase 3 的勾选状态，改为：

- [x] ITIS API 集成（学名检索 + 完整谱系 + 中文名字典）
- [x] IUCN API 集成（Provider 抽象；`static` 默认，`iucn_v4` 需 token）
- [ ] IUCN v4 token 申请与实网验证

并补一段「IUCN 合规说明」，记录 ToU 对 mobile app 的限制与当前选型理由。

**Step 5: 提交** — `git commit -m "docs: align phase3 status with actual itis/iucn integration"`

---

## 五、执行顺序与依赖

```
A1 ─→ A2 ─→ A3 ──┬─→ B1 ─→ B2 ─→ B3 ──┐
                  │                      ├─→ C4 ─→ D1 ──┐
C2（独立，可先做）─┘                      │               │
                  └─→ C1 ─→ C3 ─────────┘               │
                                                          ↓
                              D2 ─→ D3 ──────────────→ E1 ─→ E2 ─→ F1 ─→ F2 ─→ F3
```

- **C2 可以立刻单独做**：它是纯粹的 bug 修复，不依赖任何外部改动，且当前会误报濒危等级
- **E1 与后端解耦**：契约统一修好后，即使后端还没全通，前端也不会静默退回 mock
- **C3 被 token 阻塞**：拿不到 token 就先停在这一步，链路用 `static` provider 依然完整可用

## 六、风险与注意事项

| 风险 | 应对 |
|------|------|
| IUCN ToU 可能不允许 App 场景 | 默认走 `static`；`iucn_v4` 作为可切换选项，不作为唯一依赖 |
| ITIS `jsonservice` 是较老的 SOAP-derived 端点，未来可能下线 | Provider 化，替换实现不影响上层；在 `README.md` 记录端点与实测日期 |
| ITIS 返回 ISO-8859-1 这一行为未在任何文档中声明 | Task A1 用真实字节写测试锁定该行为，避免上游改动后静默乱码 |
| 中文名字典是手工数据，可能出错 | 只用于展示层，检索失败可回退学名；不参与任何判定逻辑 |
| 放开缓存后改了数据看不到效果 | `/health` 暴露 `cacheStats()`，提供 `invalidateCache()` 便于调试 |
| `server/.env` 未被 `.gitignore` 忽略，且当前含真实 Unsplash key | **本计划外，但建议立刻处理**：加入忽略规则，轮换已泄露的 key |

## 七、不在本计划范围内

- OpenAI / DeepSeek Vision 识别准确率优化（另开计划）
- 前端 `Baby`/`Favorites` 等页面的数据接入
- 亚种级（`Panthera tigris altaica`）的独立展示
- 数据库持久化（当前仍全为内存 / 外部 API 直取）
