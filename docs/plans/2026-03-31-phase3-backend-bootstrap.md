# Phase 3 Backend Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 启动 Phase 3，创建可运行的 Node.js + Express 后端骨架，并先打通 `POST /api/recognize`、`GET /api/search` 两条最小可用链路。

**Architecture:** 在项目根目录新增 `server/` 子项目，采用 TypeScript + Express。API 层先返回稳定 mock 数据，前端后续可切换为调用该服务，避免与 OpenAI/ITIS/IUCN 的真实接入耦合。统一在 `server/src` 内分为 `routes`、`services`、`types`、`middleware`，先把错误处理与健康检查标准化。

**Tech Stack:** Node.js 22+, Express, TypeScript, tsx, cors, dotenv, zod, jest/supertest（后端测试）

### Task 1: 初始化后端工程结构

**Files:**

- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/src/index.ts`
- Create: `server/src/app.ts`
- Create: `server/src/routes/index.ts`

**Step 1: Write the failing test**

```ts
// server/src/__tests__/health.test.ts
import request from 'supertest';
import { app } from '../app';

describe('GET /health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npm test -- health.test.ts`
Expected: FAIL with module/file not found.

**Step 3: Write minimal implementation**

```ts
// server/src/app.ts
import express from 'express';
export const app = express();
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
```

**Step 4: Run test to verify it passes**

Run: `cd server && npm test -- health.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add server
git commit -m "feat(server): bootstrap express service with health check"
```

### Task 2: 建立统一错误响应与路由分层

**Files:**

- Create: `server/src/middleware/errorHandler.ts`
- Create: `server/src/types/api.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/routes/index.ts`
- Test: `server/src/__tests__/errorHandler.test.ts`

**Step 1: Write the failing test**

```ts
import request from 'supertest';
import { app } from '../app';

describe('Error handler', () => {
  it('returns standard error body', async () => {
    const res = await request(app).get('/api/not-exists');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npm test -- errorHandler.test.ts`
Expected: FAIL with unexpected response structure.

**Step 3: Write minimal implementation**

```ts
// error response shape
{ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }
```

**Step 4: Run test to verify it passes**

Run: `cd server && npm test -- errorHandler.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add server/src
git commit -m "feat(server): add standard api error handling"
```

### Task 3: 实现 `POST /api/recognize` 的 mock 版本

**Files:**

- Create: `server/src/routes/recognize.ts`
- Create: `server/src/services/recognitionService.ts`
- Modify: `server/src/routes/index.ts`
- Test: `server/src/__tests__/recognizeRoute.test.ts`

**Step 1: Write the failing test**

```ts
import request from 'supertest';
import { app } from '../app';

describe('POST /api/recognize', () => {
  it('returns mock recognition result', async () => {
    const res = await request(app)
      .post('/api/recognize')
      .send({ image: 'base64-or-uri' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.animal.commonNameZh).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npm test -- recognizeRoute.test.ts`
Expected: FAIL with 404 or shape mismatch.

**Step 3: Write minimal implementation**

```ts
router.post('/recognize', (_req, res) => {
  res.json({
    success: true,
    data: { animal: { commonNameZh: '东北虎' }, confidence: 0.98 },
  });
});
```

**Step 4: Run test to verify it passes**

Run: `cd server && npm test -- recognizeRoute.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add server/src
git commit -m "feat(server): add mock recognize endpoint"
```

### Task 4: 实现 `GET /api/search` 的 mock 版本

**Files:**

- Create: `server/src/routes/search.ts`
- Create: `server/src/services/searchService.ts`
- Modify: `server/src/routes/index.ts`
- Test: `server/src/__tests__/searchRoute.test.ts`

**Step 1: Write the failing test**

```ts
import request from 'supertest';
import { app } from '../app';

describe('GET /api/search', () => {
  it('returns paginated search result', async () => {
    const res = await request(app).get('/api/search?q=虎&limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npm test -- searchRoute.test.ts`
Expected: FAIL with 404 or response mismatch.

**Step 3: Write minimal implementation**

```ts
router.get('/search', (req, res) => {
  const q = String(req.query.q || '');
  res.json({
    success: true,
    data: { total: 1, items: [{ id: '1', commonNameZh: `${q}示例` }] },
  });
});
```

**Step 4: Run test to verify it passes**

Run: `cd server && npm test -- searchRoute.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add server/src
git commit -m "feat(server): add mock search endpoint"
```

### Task 5: 前端增加后端 URL 与调用占位（不切换默认行为）

**Files:**

- Create: `src/services/api.ts`
- Modify: `src/services/recognitionService.ts`
- Modify: `DEVELOPMENT.md`
- Test: `src/services/__tests__/recognitionService.test.ts`

**Step 1: Write the failing test**

```ts
it('keeps mock mode by default when backend url is not enabled', async () => {
  const result = await recognizeAnimal('file:///tmp/tiger.jpg');
  expect(result.animal.commonNameZh).toBe('东北虎');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/__tests__/recognitionService.test.ts`
Expected: FAIL if behavior accidentally changed.

**Step 3: Write minimal implementation**

```ts
// api.ts
export const API_BASE_URL = 'http://10.0.2.2:3000';

// recognitionService.ts
const USE_BACKEND_API = false;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/__tests__/recognitionService.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/services DEVELOPMENT.md
git commit -m "chore(app): prepare backend api integration toggle"
```

### Task 6: 端到端联调与验收

**Files:**

- Modify: `DEVELOPMENT.md`
- Optional: `README.md`

**Step 1: Run backend**

Run: `cd server && npm run dev`
Expected: `Server listening on 3000`.

**Step 2: Run app**

Run: `npm start` and `npm run android`
Expected: app can open, capture/select image, enter recognition flow.

**Step 3: Verify API endpoints manually**

Run:

```bash
curl -X POST http://localhost:3000/api/recognize -H 'Content-Type: application/json' -d '{"image":"demo"}'
curl "http://localhost:3000/api/search?q=虎&limit=10&offset=0"
```

Expected: both return `{ success: true, data: ... }`.

**Step 4: Final tests**

Run:

```bash
cd server && npm test
cd .. && npm test -- src/services/__tests__/recognitionService.test.ts src/utils/__tests__/image.test.ts src/screens/__tests__/cameraError.test.ts
npx tsc --noEmit
```

Expected: all pass.

**Step 5: Commit**

```bash
git add DEVELOPMENT.md README.md
git commit -m "docs: update phase3 backend bootstrap progress"
```
