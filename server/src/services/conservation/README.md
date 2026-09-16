# IUCN Red List API v4 —— 接口契约实测记录

> 首次实测：**2026-09-16** ｜ 复测修正：**2026-09-17**（node 22 / 直连，非代理）
> 记录目的：v3 → v4 的迁移坑很多（鉴权格式、端点路径全变了），
> 这里把踩过的结论固化下来，避免下次重复调研。
> 2026-09-17 复测推翻了第 2 节原有的 Bearer 结论，已按实测矩阵重写。

## 1. v3 已死，且账号不迁移

| 项 | 结论 |
|----|------|
| `apiv3.iucnredlist.org/api/v3/*` | **HTTP 403**，v3 于 2025-03-27（Red List 2025-1 更新后）下线 |
| v3 账号 | 官方明确「no v3 API accounts were migrated」，**必须重新注册** |
| v4 无 token | `api.iucnredlist.org/api/v4/*` 返回 403 `{"error":"Forbidden"}` |

## 2. 鉴权头与失败状态码（2026-09-17 复测修正）

> ⚠️ **修正**：早前记录的「`Bearer <token>` 会 403」**是错的**。2026-09-17 用真实 token
> 复测发现 `Bearer` **同样返回 200**（scheme 大小写不敏感）。真正决定成败的是状态码语义，
> 见下方矩阵。本文实现的 `Authorization: <token>` 写法依然可用，无需改动。

实测矩阵（token 为真实有效值，27 行 4 列逐条 curl 验证）：

| `Authorization` 头 | HTTP | 含义 |
|--------------------|------|------|
| `<token>` | 200 | ✅ 裸 token（本实现采用） |
| `Bearer <token>` | 200 | ✅ 也能通过，**不是**错误用法 |
| `bearer <token>` | 200 | ✅ scheme 大小写不敏感 |
| `Token <token>` | 401 | ❌ 无法识别的 scheme |
| `<无效 token>` | **401** | ❌ 有 token 但无效 |
| `Bearer <无效 token>` | 401 | ❌ 同上 |
| `Authorization: `（空值） | 403 | ❌ 没有可用的鉴权信息 |
| 不带头 | 403 | ❌ 同上 |

**关键：401 与 403 是两个不同故障，排查时不要混淆**

- **403 `{"error":"Forbidden"}`** = 请求压根没带上可用的凭据 → 检查 `.env` 是否加载、
  环境变量是否拼错、部署平台是否把 `IUCN_API_TOKEN` 透传进去了。
- **401** = 带上了凭据但服务端不认 → token 过期 / 抄错 / 用了 v3 时期的旧 key。

两者都**不是 404**，所以都会被上层当作「上游故障」抛错并降级（不返回假等级）。
但日志里看到 401 时该去换 token，看到 403 时该去查配置加载——这是本节存在的意义。

## 3. 三跳链路（本 Provider 的实现依据）

| 步骤 | 端点 | 关键字段 |
|------|------|---------|
| 1 | `GET /taxa/scientific_name?genus_name={属}&species_name={种}` | `taxon.sis_id` |
| 2 | `GET /taxa/sis/{sis_id}` | `assessments[]`，取 `latest: true` 那条的 `assessment_id` |
| 3 | `GET /assessment/{assessment_id}` | `red_list_category.code`、`population_trend`、`year_published`、`supplementary_info.population_size`、`threats[]` |

注意事项：

- **第 1 跳只接受拆分后的属名与种名**，传完整二名法 `scientific_name=Panthera tigris` 会 404。
  亚种（三段学名）需归并到种，例如 `Panthera tigris altaica` → `genus_name=Panthera&species_name=tigris`。
- `GET /taxa/{sis_id}` **不存在**（404）。正确路径是 `/taxa/sis/{sis_id}`。
- `GET /api/v4/` 根路径不存在（404 HTML），**没有可用的机器可读 swagger 文档**；
  `/api_doc`、`/docs`、`/openapi.json` 同样不可用。字段名以实测报文为准。

## 4. 字段映射

| 本项目字段 | IUCN 字段 | 说明 |
|-----------|-----------|------|
| `iucnStatus` | `red_list_category.code` | 九级枚举，认不出一律 `DD` |
| `populationTrend` | `population_trend.description.en` | 取值 Decreasing / Stable / Increasing / Unknown |
| `assessmentYear` | `year_published` | 字符串，需转数字 |
| `population` | `supplementary_info.population_size` | **常是区间**，如 `"2608-3905,3140"`；只有纯整数才取值，否则留空 |
| `threats` | `threats[].description.en` | 去重后最多取 5 条 |

> 注意：`assessment.population_trend` 的 `code` 是 `"1"/"2"/"3"`，
> 但没有公开文档说明其语义，因此实现**只认 `description.en` 文本**，不猜 code。

## 5. 合规提醒

IUCN ToU 明确写明 API 面向教育/研究用途，且提到
"may need to restrict access if … such as mobile app development"。
因此本项目默认 `CONSERVATION_SOURCE=static`（离线数据集），
在线 v4 仅作为**可切换选项**，不作为唯一依赖。
