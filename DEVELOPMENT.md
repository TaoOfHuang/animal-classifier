# 物种图鉴 App 开发方案

> 动物分类识别 Android 应用 - React Native 实现

## 项目概述

一款基于图像识别的动物分类 App，用户可以通过拍照或上传图片识别动物，查看其完整的生物学分类信息（界门纲目科属种），并以树形图方式探索分类体系。

### 核心功能

1. **图像识别** - 拍照或上传图片识别动物
2. **分类展示** - 展示完整的生物学分类路径（中英文）
3. **分类树导航** - 展开式树状图，支持上下追溯
4. **动物搜索** - 按名称搜索动物
5. **详情展示** - 栖息地、生活习性、濒危状态等信息
6. **本地缓存** - 缓存已查询的动物信息

---

## 技术架构

### 前端 (React Native)

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│  │ 相机模块 │  │ 图片选择 │  │ 搜索模块 │  │ 树形图展示  │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘ │
└───────┼────────────┼───────────┼───────────────┼────────┘
        │            │           │               │
        v            v           v               v
┌─────────────────────────────────────────────────────────┐
│                     后端服务 (Node.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ 图像识别服务  │  │ 分类数据服务  │  │ 动物信息服务  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │                  │
          v                 v                  v
   ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐
   │ OpenAI Vision│  │ ITIS + IUCN │  │ Unsplash/Pexels  │
   │     API      │  │    APIs     │  │      API         │
   └──────────────┘  └─────────────┘  └──────────────────┘
```

### 技术选型

| 模块         | 技术方案                       |
| ------------ | ------------------------------ |
| **框架**     | React Native 0.84 (CLI)        |
| **语言**     | TypeScript                     |
| **导航**     | React Navigation v7 ✅         |
| **状态管理** | Context + Reducer ✅           |
| **相机**     | react-native-image-picker ✅   |
| **图片选择** | react-native-image-picker ✅   |
| **本地缓存** | @react-native-async-storage ✅ |
| **后端**     | Node.js + Express ✅           |
| **图像识别** | OpenAI Vision API (计划)       |
| **分类数据** | ITIS + IUCN APIs ✅            |
| **动物图片** | Unsplash/Pexels API ✅         |

---

## 项目结构

```
AnimalClassifier/
├── App.tsx                      # 应用入口（集成 AppProvider）
├── src/
│   ├── components/              # 通用组件
│   │   ├── Button.tsx           # 按钮组件
│   │   ├── Card.tsx             # 卡片组件
│   │   ├── Icon.tsx             # 图标组件（Unicode）
│   │   ├── Header.tsx           # 页面头部
│   │   ├── SearchBar.tsx        # 搜索框
│   │   ├── AnimalCard.tsx       # 动物卡片
│   │   ├── ActionCard.tsx       # 操作卡片
│   │   ├── TaxonomyPath.tsx     # 分类路径标签
│   │   ├── EndangeredBadge.tsx  # 濒危状态徽章
│   │   ├── Breadcrumb.tsx       # 面包屑导航 ✅ NEW
│   │   ├── TreeNode.tsx         # 分类树节点 ✅ NEW
│   │   ├── AutoComplete.tsx     # 搜索自动补全 ✅ NEW
│   │   ├── ImageCarousel.tsx    # 图片轮播 ✅ NEW
│   │   └── index.ts
│   ├── screens/                 # 页面
│   │   ├── HomeScreen.tsx       # 首页
│   │   ├── SearchScreen.tsx     # 搜索页（增强版）✅ UPDATED
│   │   ├── CameraScreen.tsx     # 相机页
│   │   ├── ImagePickerScreen.tsx# 图片选择页
│   │   ├── RecognitionScreen.tsx# 识别处理页
│   │   ├── ResultScreen.tsx     # 识别结果页
│   │   ├── AnimalDetailScreen.tsx# 动物详情页（增强版）✅ UPDATED
│   │   ├── TaxonomyTreeScreen.tsx# 分类树页面（优化版）✅ UPDATED
│   │   └── index.ts
│   ├── navigation/              # 导航配置
│   │   └── AppNavigator.tsx
│   ├── constants/               # 常量定义
│   │   ├── theme.ts             # 主题（颜色、字体、间距）
│   │   ├── taxonomy.ts          # 分类相关常量
│   │   └── index.ts
│   ├── types/                   # TypeScript 类型
│   │   ├── animal.ts            # 动物相关类型
│   │   ├── navigation.ts        # 导航类型
│   │   └── index.ts
│   ├── services/                # API 服务层
│   │   ├── api.ts               # API 客户端配置
│   │   ├── recognitionService.ts# 图像识别服务
│   │   ├── taxonomyService.ts   # 分类数据服务 ✅ NEW
│   │   ├── searchService.ts     # 搜索服务 ✅ NEW
│   │   └── storageService.ts    # 本地存储服务 ✅ NEW
│   ├── hooks/                   # 自定义 Hooks
│   │   └── (计划中)
│   ├── store/                   # 状态管理
│   │   ├── useAppStore.tsx      # 全局状态 ✅ NEW
│   │   └── index.ts
│   ├── utils/                   # 工具函数
│   │   ├── image.ts             # 图片处理
│   │   └── format.ts            # 格式化工具
│   └── assets/                  # 静态资源
│       └── images/
├── server/                      # 后端服务
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.ts
│   └── package.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## 页面流程

```
┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌────────────┐
│  首页   │────>│ 相机/相册 │────>│  识别处理   │────>│  识别结果  │
└─────────┘     └──────────┘     └─────────────┘     └─────┬──────┘
     │                                                      │
     │  ┌─────────┐                                        │
     └─>│  搜索   │                                        │
        └────┬────┘                                        │
             │                                              │
             v                                              v
        ┌─────────────┐                            ┌─────────────┐
        │  搜索结果   │───────────────────────────>│  动物详情   │
        └─────────────┘                            └──────┬──────┘
                                                          │
                                                          v
                                                   ┌─────────────┐
                                                   │   分类树    │
                                                   └─────────────┘
```

---

## 开发阶段

### Phase 1: 项目初始化 + 基础 UI 框架 ✅ 已完成

**完成内容：**

- [x] React Native 项目初始化
- [x] TypeScript 配置
- [x] 主题系统（颜色、字体、间距、阴影）
- [x] 导航配置 (React Navigation)
- [x] 基础组件库
  - [x] Button - 多样式按钮
  - [x] Card - 卡片容器
  - [x] Icon - 图标组件
  - [x] Header - 页面头部
  - [x] SearchBar - 搜索框
  - [x] AnimalCard - 动物卡片
  - [x] ActionCard - 操作卡片
  - [x] TaxonomyPath - 分类路径
  - [x] EndangeredBadge - 濒危徽章
- [x] 所有页面 UI 实现（使用模拟数据）
  - [x] HomeScreen - 首页
  - [x] SearchScreen - 搜索页
  - [x] CameraScreen - 相机页（占位）
  - [x] ImagePickerScreen - 图片选择页（占位）
  - [x] RecognitionScreen - 识别处理页
  - [x] ResultScreen - 识别结果页
  - [x] AnimalDetailScreen - 动物详情页
  - [x] TaxonomyTreeScreen - 分类树页面

**已安装依赖：**

```json
{
  "@react-navigation/native": "^7.x",
  "@react-navigation/native-stack": "^7.x",
  "react-native-screens": "^4.x",
  "react-native-safe-area-context": "^5.x",
  "react-native-linear-gradient": "^2.x"
}
```

---

### Phase 2: 相机/相册集成 + 图像识别 ✅ 已完成

**完成内容：**

- [x] 安装配置 Android Studio
- [x] 配置 JDK 17 和 Android SDK 环境变量
- [x] 安装 react-native-image-picker
- [x] 配置 Android 相机和存储权限
- [x] 实现真实相机拍照功能 (CameraScreen)
- [x] 实现相册图片选择功能 (ImagePickerScreen)
- [x] 修复模拟器相机不可用时的降级处理（自动引导到相册）
- [x] 实现图片预处理工具（格式推断、文件名推断、输入校验）
- [x] 实现识别服务层 `recognitionService`（mock/real 切换骨架）
- [x] RecognitionScreen 接入服务层（替换页面内 mock 逻辑）
- [x] 创建 Android 模拟器并测试
- [x] 图片压缩和预处理（基础版）

**待完成：**

- [ ] 连接 OpenAI Vision API 进行识别（当前为 mock 模式）

**已安装依赖：**

```json
{
  "react-native-image-picker": "^7.x"
}
```

**环境配置：**

- JDK 17: `/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home`
- Android SDK: `~/Library/Android/sdk`
- 已在 `android/gradle.properties` 中配置 `org.gradle.java.home`
- 已在 `AndroidManifest.xml` 中添加相机和存储权限

---

### Phase 3: 后端服务 + API 集成 ✅ 已完成

**完成内容：**

- [x] 创建 Node.js + Express 后端基础骨架（TypeScript）
- [x] API 路由基础结构与统一错误响应
- [x] `POST /api/recognize` 接口（LLM 视觉识别 + ITIS/IUCN 富化）
- [x] `GET /api/search` 接口（含 `GET /api/search/suggestions`）
- [x] `GET /api/animal/:id` 接口（按学名解析，未知物种返回 404）
- [x] `GET /api/taxonomy/:level/:name` 接口（契约对齐 `current/parent/childCount`）
- [x] `GET /api/taxonomy/:level/:name/children` 接口（分类树懒加载）
- [x] `GET /api/taxonomy/search` 接口（支持中文入口）
- [x] 后端 health 检查与端口配置校验
- [x] ITIS API 集成（学名检索 + 完整谱系 + 中文名字典）
- [x] IUCN API 集成（Provider 抽象；`static` 默认，`iucn_v4` 需 token）
- [x] Unsplash/Pexels API 集成（动物图片，失败兜底）
- [x] 错误处理和重试机制（仅 5xx 与网络错误重试 + 退避；4xx 不重试）

**待完成：**

- [x] IUCN v4 token 申请与实网验证（2026-09-17 实测三跳链路 + Provider 解析通过）
- [ ] 接入独立的 Vision API（当前实际走 DeepSeek V4.1 Flash 视觉模型）

**后端验证：**

- `cd server && npm test` ✅ (17 suites, 155 tests)
- 前端 `npm test` ✅ (12 suites, 158 tests)
- 上游失败路径均有对应用例：ITIS 404 / 超时 / 网络错误 / 5xx，IUCN 401 / 403 / 404 / 5xx / 缺 token
  （401 与 403 的实际语义区分见 `server/src/services/conservation/README.md` 第 2 节）

**前端联动状态：**

- 后端开关已集中到 `src/services/api.ts` 的 `USE_BACKEND_API_DEFAULT`（当前 `true`），
  `searchService` / `taxonomyService` 都从这里读取，不再各留一份私有常量
- `requestJson()` 统一解包 `{success, data}` 信封；失败走 `logApiFallback()` 打 `console.error`，
  不再用 `console.warn` 把故障吞掉
- ⚠️ 改动该开关后**必须复查前端 service 的既有测试**：断言 mock 分支的用例会真的去打网络并挂住

**第三方 API 环境变量（server/.env）：**

- `CONSERVATION_SOURCE=static`（濒危信息数据源；改 `iucn_v4` 需下方 token）
- `IUCN_API_TOKEN=`
- `UNSPLASH_ACCESS_KEY=`
- `PEXELS_API_KEY=`

**IUCN 合规说明（当前选型的理由）**

IUCN ToU 明确写明 API 面向**教育 / 研究**用途，并提示
"may need to restrict access if … such as mobile app development"，商业用途严禁。
本项目是 Android App，因此**不把 IUCN v4 设为唯一路径**：

- 抽象出 `ConservationProvider` 接口，离线实现 `staticProvider`（本地数据集）、
  在线实现 `iucnV4Provider`
- 默认 `CONSERVATION_SOURCE=static`，在线 v4 只作为**可切换选项**，不作为唯一依赖
- v4 接口契约实测记录见 `server/src/services/conservation/README.md`
  （鉴权头是裸 token 而非 Bearer、三跳链路、population 常是区间等坑）

**核对时间：** 以上状态据 2026-09-16 的实际代码与测试结果逐项核对。

---

### Phase 4: 分类树形图组件优化 ✅ 已完成

**完成内容：**

- [x] 创建前端 `taxonomyService` 服务层
  - 支持懒加载子节点
  - 支持 mock/API 模式切换
  - 分类路径构建工具
- [x] 创建 `Breadcrumb` 面包屑导航组件
  - 支持多种变体（default/compact/pill）
  - 可点击跳转
  - 自动截断过长路径
- [x] 创建 `TreeNode` 分类树节点组件
  - 展开/收起动画（旋转箭头）
  - 懒加载子节点
  - 长按预览功能
  - 当前节点高亮
  - "加载更多"按钮
- [x] 优化 `TaxonomyTreeScreen` 主页面
  - 集成面包屑导航
  - 下拉刷新支持
  - 加载状态和错误处理
  - 选中节点浮动卡片
  - 节点导航跳转

**新增组件：**

- `src/components/Breadcrumb.tsx`
- `src/components/TreeNode.tsx`
- `src/services/taxonomyService.ts`

---

### Phase 5: 动物详情页 + 搜索功能完善 ✅ 已完成

**完成内容：**

- [x] 创建前端 `searchService` 搜索服务
  - 搜索动物（支持分页）
  - 搜索建议（自动补全）
  - 搜索历史管理
  - 热门搜索词
  - 获取动物详情
- [x] 创建 `AutoComplete` 自动补全组件
  - 搜索建议实时显示
  - 搜索历史展示
  - 热门搜索标签
  - 可删除单条历史
  - 清空历史功能
- [x] 创建 `ImageCarousel` 图片轮播组件
  - 自动播放
  - 手势滑动
  - 分页指示器
  - 全屏查看模式
  - 图片计数器
- [x] 优化 `SearchScreen` 搜索页
  - 搜索结果分页加载
  - 搜索历史记录
  - 热门搜索（前3高亮）
  - 结果统计显示
  - 空状态处理
- [x] 优化 `AnimalDetailScreen` 动物详情页
  - 图片轮播（替代横向滚动）
  - 收藏功能（心形按钮动画）
  - 分享功能
  - 快速信息栏（科/属/种群）
  - 种群趋势徽章
  - 更多选项菜单

**新增组件：**

- `src/components/AutoComplete.tsx`
- `src/components/ImageCarousel.tsx`
- `src/services/searchService.ts`

---

### Phase 6: 本地缓存 + 性能优化 ✅ 已完成

**完成内容：**

- [x] 安装配置 `@react-native-async-storage/async-storage`
- [x] 创建 `storageService` 本地存储服务
  - 通用缓存接口（带 TTL 过期机制）
  - 搜索历史持久化
  - 收藏列表管理
  - 最近浏览记录
  - 动物数据缓存
  - 分类数据缓存
  - 应用设置存储
  - 缓存统计信息
- [x] 创建 `useAppStore` 全局状态管理
  - 基于 Context + Reducer 模式
  - 收藏状态（toggleFavorite, isFavorite）
  - 最近浏览（addRecentAnimal）
  - 搜索历史（add/remove/clear）
  - 识别状态管理
  - 应用设置
  - 缓存操作
- [x] 集成 `AppProvider` 到应用入口
- [x] 导出便捷 Hooks
  - `useFavorites`
  - `useRecentAnimals`
  - `useSearchHistory`
  - `useRecognition`
  - `useAppSettings`

**已安装依赖：**

```json
{
  "@react-native-async-storage/async-storage": "^2.x"
}
```

**新增文件：**

- `src/services/storageService.ts`
- `src/store/useAppStore.tsx`
- `src/store/index.ts`

---

### Phase 7: 测试 + Bug 修复 + 发布准备 ✅ 已完成

**完成内容：**

- [x] 设置测试框架（Jest + React Native Testing Library）
  - 配置 jest.config.js 支持 React Native
  - 创建 jest.setup.js 统一 mock
  - 安装 @testing-library/react-native
- [x] 单元测试（147 个测试用例全部通过）
  - `src/services/__tests__/searchService.test.ts` - 搜索服务测试
  - `src/services/__tests__/taxonomyService.test.ts` - 分类服务测试
  - `src/services/__tests__/storageService.test.ts` - 存储服务测试
  - `src/services/__tests__/recognitionService.test.ts` - 识别服务测试
  - `src/utils/__tests__/image.test.ts` - 图片工具测试
  - `src/screens/__tests__/cameraError.test.ts` - 相机错误处理测试
- [x] 组件测试
  - `src/components/__tests__/Button.test.tsx` - 按钮组件测试
  - `src/components/__tests__/AnimalCard.test.tsx` - 动物卡片测试
  - `src/components/__tests__/EndangeredBadge.test.tsx` - 濒危徽章测试
  - `src/components/__tests__/SearchBar.test.tsx` - 搜索框测试
- [x] 集成测试
  - `src/store/__tests__/useAppStore.test.tsx` - 全局状态管理测试
- [x] Bug 修复
  - 修复 TaxonomyInfo 类型定义（改为可选属性）
  - 修复 TaxonomyPath 组件空值处理
  - 修复 ESLint 配置（添加 jest 环境）
- [x] 启动画面配置
  - 安装 react-native-splash-screen
  - 创建启动画面布局和样式
  - 配置深棕色主题背景
- [x] 应用签名配置
  - 配置 debug 签名
  - 添加 release 签名模板（`android/keystore.properties.example`，真实密码不入库）
  - 更新 build.gradle 支持发布签名（含「未配置即回退 debug 签名」的保护与提示）
- [x] 构建脚本
  - `npm run build:android` - 构建 Release APK
  - `npm run build:android:bundle` - 构建 AAB（Google Play）
  - `npm run clean:android` - 清理构建缓存
  - `npm run test:coverage` - 测试覆盖率
  - `npm run typecheck` - TypeScript 类型检查

**已安装依赖：**

```json
{
  "react-native-splash-screen": "^3.3.0",
  "@testing-library/react-native": "^13.x",
  "@testing-library/jest-native": "^5.x"
}
```

**测试覆盖：**

- 测试套件：12 个
- 测试用例：147 个
- 通过率：100%

**新增文件：**

- `jest.config.js` - Jest 配置
- `jest.setup.js` - Jest 全局 mock
- `android/app/src/main/res/drawable/launch_screen.xml` - 启动画面
- `android/app/src/main/res/layout/launch_screen.xml` - 启动画面布局
- `android/app/src/main/res/values/colors.xml` - 颜色资源

---

## 设计规范

### 颜色系统

```typescript
// 主色调 - 大地与森林
earthDark: '#1a1612'; // 深棕（背景）
earth: '#2d2620'; // 棕色
bark: '#4a3f35'; // 树皮色（次要文字）

// 绿色系 - 苔藓与树叶
moss: '#3d5a3d'; // 苔藓绿（主要按钮）
mossLight: '#5a7a5a'; // 浅苔藓绿
leaf: '#7fa650'; // 叶绿色
leafGlow: '#a8d450'; // 亮绿色

// 中性色
sand: '#c4b69c'; // 沙色（占位文字）
cream: '#f5f0e6'; // 奶油色（卡片背景）
ivory: '#fdfbf7'; // 象牙白（页面背景）

// 强调色
amber: '#d4a84b'; // 琥珀色（重点元素）
amberGlow: '#f0c060'; // 亮琥珀色
coral: '#d85a4a'; // 珊瑚红（濒危警示）
```

### 濒危等级颜色

```typescript
CR: '#c41e3a'; // 极危 - 深红
EN: '#d85a4a'; // 濒危 - 珊瑚红
VU: '#e89b4a'; // 易危 - 橙色
NT: '#f0c060'; // 近危 - 金色
LC: '#7fa650'; // 无危 - 绿色
```

### 间距系统

```typescript
xs: 4; // 极小间距
sm: 8; // 小间距
md: 16; // 中等间距
lg: 24; // 大间距
xl: 32; // 超大间距
xxl: 48; // 极大间距
```

### 圆角系统

```typescript
sm: 8; // 小圆角
md: 12; // 中等圆角
lg: 20; // 大圆角
xl: 28; // 超大圆角
full: 9999; // 全圆角（胶囊形）
```

---

## API 设计（后端）

### 图像识别

```
POST /api/recognize
Content-Type: application/json

Request:
- image: string (图片 base64 data URL 或本地 uri)
- 需要 Authorization: Bearer <API_TOKEN>

Response:
{
  "success": true,
  "data": {
    "animal": {
      "id": "Panthera tigris",
      "commonNameZh": "东北虎",
      "commonNameEn": "Siberian Tiger",
      "scientificName": "Panthera tigris",
      "taxonomy": { ... },
      "conservationStatus": { ... }
    },
    "confidence": 0.985,
    "dataSources": {
      "taxonomy": "itis",
      "conservation": "static"
    }
  }
}
```

> `dataSources.taxonomy` 取值 `itis | llm | none`，`dataSources.conservation` 取值
> `iucn_v4 | static | none`，用于区分「这条数据到底来自哪」。
> LLM 给出的 taxonomy 会被 ITIS 结果覆盖；ITIS 查不到时保留 LLM 的结果。
> 两个上游各自独立降级，任一方失败都不会让整个请求失败。

### 获取动物详情

```
GET /api/animal/:id

:id 为学名（也接受中文俗名，如 东北虎）

Response:
{
  "success": true,
  "data": {
    "id": "Panthera tigris",
    "commonNameZh": "东北虎",
    "commonNameEn": "Siberian Tiger",
    "scientificName": "Panthera tigris",
    "taxonomy": {
      "kingdom": { "scientificName": "Animalia", "commonNameZh": "动物界" },
      "phylum": { "scientificName": "Chordata", "commonNameZh": "脊索动物门" },
      ...
    },
    "images": ["url1", "url2"],
    "habitat": "...",
    "lifestyle": "...",
    "distribution": "...",
    "conservationStatus": {
      "iucnStatus": "EN",
      "population": 500,
      "populationTrend": "stable",
      "assessmentYear": 2021
    },
    "dataSources": { "taxonomy": "itis", "conservation": "static" }
  }
}
```

未知物种返回 **404**：

```json
{ "success": false, "error": { "code": "ANIMAL_NOT_FOUND", "message": "No animal found for \"...\"" } }
```

> 上游不可达且本地也查不到时返回 **502 `ANIMAL_UPSTREAM_FAILED`**，而不是 404
> —— 「上游挂了」不等于「没有这个物种」。`:id` 为空则 400 `INVALID_ANIMAL_ID`。

### 搜索动物

```
GET /api/search?q=熊猫&limit=20&offset=0

Response:
{
  "success": true,
  "data": {
    "total": 2,
    "items": [
      {
        "id": "string",
        "commonNameZh": "大熊猫",
        "commonNameEn": "Giant Panda",
        "scientificName": "Ailuropoda melanoleuca",
        "family": "Ursidae",
        "familyZh": "熊科",
        "thumbnailUrl": "..."
      }
    ],
    "hasMore": false
  }
}
```

> `q` 为空直接返回空结果集；上游失败时降级为 `200 + 空结果`，不让前端吃 500。
> 参数非法（`limit` 超 50 等）返回 400 `INVALID_SEARCH_QUERY`。

### 搜索自动补全

```
GET /api/search/suggestions?q=虎&limit=5

Response:
{
  "success": true,
  "data": { "suggestions": ["虎", "东北虎", "雪豹"] }
}
```

### 获取分类树（详情）

```
GET /api/taxonomy/family/Felidae

Response:
{
  "success": true,
  "data": {
    "current": {
      "id": "180580",
      "level": "family",
      "scientificName": "Felidae",
      "commonNameZh": "猫科"
    },
    "parent": { "id": "180539", "level": "order", "scientificName": "Carnivora", "commonNameZh": "食肉目" },
    "childCount": 14
  }
}
```

> 契约是 `{ current, parent, childCount }` —— **不再返回 `children`**（历史实现返回 children，
> 前端拿到的永远是 `undefined`）。`:name` 必须真的属于所请求的 `:level`，否则 404 `TAXONOMY_NOT_FOUND`
> （例如 `family/Panthera` 会被拒掉，而不是悄悄当成 Felidae）。
> 层级非法 → 400 `INVALID_TAXONOMY_LEVEL`；`:name` 未过白名单 → 400 `INVALID_TAXONOMY_QUERY`；
> 上游不可达 → 502 `TAXONOMY_UPSTREAM_FAILED`。

### 获取分类树（子节点，懒加载）

```
GET /api/taxonomy/genus/Panthera/children?limit=10&offset=0

Response:
{
  "success": true,
  "data": {
    "children": [
      {
        "id": "183805",
        "level": "species",
        "scientificName": "Panthera tigris",
        "commonNameZh": "虎"
      }
    ],
    "hasMore": true,
    "total": 5,
    "childLevel": "species"
  }
}
```

> 走 ITIS `getHierarchyDownFromTSN`（只返回直接下级，正好对应懒加载语义），
> 分页在内存里 `slice`；`childLevel` 供前端校验层级连续性。
> `limit` 默认 20、上限 100。

### 搜索分类

```
GET /api/taxonomy/search?q=虎&level=species

Response:
{
  "success": true,
  "data": {
    "results": [
      { "id": "183805", "level": "species", "scientificName": "Panthera tigris", "commonNameZh": "虎" }
    ]
  }
}
```

> 支持中文输入：先经本地中文名字典归一化到学名，再去 ITIS 检索
> （ITIS 实测不认中文，`srchKey=东北虎` 命中 0 条）。字典未收录的中文名直接返回空，不白跑一次上游。
> 检索失败降级为 `200 + 空 results`，不返回 500。

---

## 环境要求

### 开发环境

- Node.js >= 22.11.0
- npm >= 10.x
- JDK 17
- Android Studio (Hedgehog 或更高版本)
- Android SDK 34
- React Native CLI

### 运行命令

```bash
# 安装依赖
npm install

# 启动 Metro bundler
npm start

# 运行 Android
npm run android

# TypeScript 类型检查
npm run typecheck

# Lint 检查
npm run lint

# 运行测试
npm test

# 测试覆盖率
npm run test:coverage

# 构建 Release APK
npm run build:android

# 构建 AAB（Google Play 发布）
npm run build:android:bundle

# 清理 Android 构建
npm run clean:android

# 后端测试
cd server && npm test
```

---

## 发布指南

### 生成签名密钥（首次发布）

```bash
# 生成 release keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/app/release.keystore \
  -alias animal-classifier \
  -keyalg RSA -keysize 2048 -validity 10000
```

### 配置签名信息

密码**不放在 `android/gradle.properties`**（该文件会被提交到 Git）。正确做法是复制模板：

```bash
cp android/keystore.properties.example android/keystore.properties
```

然后在 `android/keystore.properties` 中填入四项（键名小写，`storeFile` 相对 `android/app/` 解析）：

```properties
storeFile=release.keystore
storePassword=your_store_password
keyAlias=animal-classifier
keyPassword=your_key_password
```

> `android/keystore.properties` 已被 `.gitignore` 忽略，不会进入版本库。
> `app/build.gradle` 的读取顺序为 **`android/keystore.properties` → `-PRELEASE_*` 命令行参数**，
> 临时传入可写 `./gradlew assembleRelease -PRELEASE_STORE_FILE=... -PRELEASE_STORE_PASSWORD=...`。
>
> 四项**缺任意一项**即视为未配置：release 构建会**回退到 debug 签名**并在任务开始时打印
> `[signing] ✗ 未配置发布签名…`。这种包仅可用于本地测性能，**无法上架应用商店**。
>
> ⚠️ keystore 文件与密码请单独备份——丢失后将无法再更新已上架的应用。

### 构建发布版

```bash
# 构建 APK（直接安装）
npm run build:android
# 输出：android/app/build/outputs/apk/release/app-release.apk

# 构建 AAB（Google Play）
npm run build:android:bundle
# 输出：android/app/build/outputs/bundle/release/app-release.aab
```

---

## 待解决问题

1. ~~**Android Studio 配置** - 需要完成环境配置才能运行应用~~ ✅ 已完成
2. **图标组件** - 当前使用 Unicode 符号，后续考虑使用 react-native-vector-icons
3. ~~**相机权限** - 需要在 AndroidManifest.xml 中添加相机权限~~ ✅ 已完成
4. **API Key 管理** - 密钥目前集中在 `server/.env`（已被 `.gitignore` 忽略），
   生产环境建议改用密钥管理服务
5. **离线支持** - 考虑添加基础的离线数据包
6. ~~**创建 Android 模拟器** - 需要在 Android Studio 中创建 AVD 才能测试应用~~ ✅ 已完成
7. **接入独立 Vision API** - 当前实际走 DeepSeek V4.1 Flash 视觉模型（`AI_PROVIDER=deepseek`）
8. ~~**IUCN v4 token** - 需到 api.iucnredlist.org 重新注册并实网验证~~ ✅ 已完成
   （2026-09-17 实网验证：token 有效，三跳链路与 Provider 解析均正确；默认仍走离线数据集）
9. **⚠️ 轮换已泄露的 Unsplash key** - `owXiMjCjNG-…` 已随初始提交（`a92f875`）进入
   **Git 历史**，`server/.env.example` 与 `server/DEPLOYMENT.md` 都提交过。
   工作区里这两个文件现已换成占位符，但 `git log -S` 仍能在历史中检出该 key，
   因此**必须在 Unsplash 后台 revoke 并重新签发**；如需从历史中彻底抹除，
   还需用 `git filter-repo` 改写历史后强推（会影响所有协作者）。

---

## 参考资源

- [React Native 官方文档](https://reactnative.dev/)
- [React Navigation 文档](https://reactnavigation.org/)
- [ITIS API](https://www.itis.gov/ws_description.html)
- [IUCN Red List API](https://api.iucnredlist.org/)（v3 已于 2025-03-27 下线）
- [Unsplash API](https://unsplash.com/developers)

---

_最后更新：2026-09-16_
_Phase 3 的 ITIS / IUCN 集成已与事实对齐（原勾选状态早于实际实现）_
