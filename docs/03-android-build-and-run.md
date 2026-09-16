# Android 构建与运行指南

> 覆盖 debug / debugOptimized / release 三种变体的构建、运行、打包与签名配置。
> 项目环境：React Native 0.84.1 + Hermes + 新架构，`applicationId = com.animalclassifier`。

---

## 一、三种构建变体对比

| 维度 | `debug` | `debugOptimized` | `release` |
|------|---------|------------------|-----------|
| JS bundle | 不打包，**连 Metro** | 不打包，**连 Metro** | **打进 APK** |
| 原生 C++ 代码 | 未优化 | **Release 模式优化** | Release 模式优化 |
| Java/Kotlin 字节码 | debug | debug | 优化（可开 minify） |
| 热重载 / 调试器 | ✅ | ✅ | ❌ |
| `__DEV__` | `true` | `true` | `false` |
| 典型用途 | 日常开发 | 测原生性能、排查性能瓶颈 | 发布、上架 |

**怎么选**：

- 平时写功能 → `debug`
- 觉得"卡得不像话，但不想反复重新构建" → `debugOptimized`，原生代码按 release 优化，热重载照旧
- 验证真实发布表现（启动速度、包体积、Hermes 差异） → `release`

> 重要前提：`debug` 和 `debugOptimized` **依赖 Metro 运行**（JS bundle 不在 APK 里）。
> 项目 `build.gradle` 中 `react` 块的 `debuggableVariants` 默认包含这两个变体，插件会跳过它们的 JS 打包步骤。

---

## 二、环境前提

```bash
node -v          # >= 22.11.0（package.json engines 要求）
java -version    # 需要 JDK 17
```

本项目的 `android/gradle.properties` 已固定 JDK 路径：

```properties
org.gradle.java.home=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home
```

> 换机器或 JDK 升级后，这行需要同步修改，否则 Gradle 会报找不到 Java。

常用命令（`package.json` 已定义）：

```bash
npm run android              # = react-native run-android
npm run build:android        # = cd android && ./gradlew assembleRelease
npm run build:android:bundle # = cd android && ./gradlew bundleRelease
npm run clean:android        # = cd android && ./gradlew clean
```

---

## 三、运行 debug 版本

```bash
# 终端 1：启动 Metro
npm start

# 终端 2：构建并安装到设备/模拟器
npm run android
# 或指定变体：
npx react-native run-android --mode=debug
```

支持热重载，改动 JS 立即生效，`console.log` 直接输出到 Metro 终端。

---

## 四、运行 debugOptimized 版本

```bash
# 仍然需要 Metro
npm start

# 另一个终端
npx react-native run-android --mode=debugOptimized
```

**什么时候用**：你怀疑卡的根源在原生侧（图片处理、大列表渲染、第三方原生库），但用 release 又太麻烦（每次改代码都要重新构建）。这个变体既保留热重载，原生性能又接近 release。

> 首次构建会比 `debug` 慢，因为原生代码要走 Release 级别的编译优化。

---

## 五、运行 release 版本

### 开发阶段（不需要正式签名）

```bash
npx react-native run-android --mode=release
```

等价写法：

```bash
cd android && ./gradlew installRelease
```

开发阶段**不需要**配置正式 keystore —— 模拟器不校验签名来源，未配置时构建会回退到 debug 签名（会有警告提示，属正常）。注意这是为了本地自测，**不能用于上架**。

### release 与 debug 的关键区别

- **不连 Metro**：JS 代码已编译进 APK，改代码必须**重新构建**才能生效
- **没有红屏报错**：出错会静默失败（白屏或行为异常），排查需看日志：

  ```bash
  adb logcat | grep -i "ReactNative\|AndroidRuntime"
  ```

- **`__DEV__ === false`**：所有 `if (__DEV__)` 的开发分支都不会执行
- **会覆盖同包名的 debug 版**：两者 `applicationId` 相同，装 release 会覆盖 debug（详见第十节）

---

## 六、打包产物（APK / AAB）

```bash
# APK —— 自测或直接分发
npm run build:android

# AAB —— 上架 Google Play 用（体积更小，由商店分发）
npm run build:android:bundle
```

产物位置：

| 类型 | 路径 |
|------|------|
| APK | `android/app/build/outputs/apk/release/app-release.apk` |
| AAB | `android/app/build/outputs/bundle/release/app-release.aab` |

> 国内应用市场（华为、小米、OPPO 等）通常要求上传 **APK**；Google Play 要求 **AAB**。

---

## 七、release 签名配置

### 背景：为什么一定要配

未配置正式签名时，`release` 包会回退使用 debug 签名。这种包：

- ❌ 无法上架任何应用商店（会被直接拒绝）
- ❌ 无法作为正式版本升级（签名不一致，Android 拒绝覆盖安装）
- ❌ 任何持有 Android 通用 debug key 的人都能伪造你的签名包

**快速自检**（看签名证书是不是 `CN=Android Debug`）：

```bash
~/Library/Android/sdk/build-tools/37.0.0/apksigner verify --print-certs \
  android/app/build/outputs/apk/release/app-release.apk
```

### 1. 生成 keystore（只需一次）

```bash
cd /path/to/AnimalClassifier

keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/app/release.keystore \
  -alias animal-classifier \
  -keyalg RSA -keysize 2048 -validity 10000
```

- `-validity 10000`：约 27 年有效期，避免证书过期导致无法更新
- 中途会要求设置密码，并询问姓名/组织等信息
- **密码务必记住**，丢了就只能换包名重新发布

### 2. 配置签名信息

```bash
cp android/keystore.properties.example android/keystore.properties
nano android/keystore.properties
```

填写内容：

```properties
storeFile=release.keystore
storePassword=你的keystore密码
keyAlias=animal-classifier
keyPassword=你的key密码
```

> `storeFile` 相对于 `android/app/` 解析。
> `keystore.properties` 已被 `.gitignore` 忽略，密码不会进版本库。

### 3. 构建时确认签名状态

项目 `build.gradle` 已加了一个提示任务，执行 `assembleRelease` 时会打印：

```
[signing] ✓ 使用正式签名: release.keystore (alias=animal-classifier)
```

如果看到的是：

```
[signing] ✗ 未配置发布签名，release 包将使用 DEBUG 签名，无法上架应用商店！
```

说明第 2 步没生效，**这个包不能用于发布**。

### 签名配置的读取逻辑

`android/app/build.gradle` 中的优先级为：

1. `android/keystore.properties`（推荐）
2. 命令行参数 `-PRELEASE_STORE_FILE=...` 等

四种参数（`storeFile` / `storePassword` / `keyAlias` / `keyPassword`）**全部提供**才算配置成功。

临时用命令行参数构建（不想落盘密码时）：

```bash
cd android
./gradlew assembleRelease \
  -PRELEASE_STORE_FILE=/绝对路径/release.keystore \
  -PRELEASE_STORE_PASSWORD=xxx \
  -PRELEASE_KEY_ALIAS=animal-classifier \
  -PRELEASE_KEY_PASSWORD=xxx
```

### 查看当前签名详情

```bash
cd android && ./gradlew :app:signingReport --console=plain
```

输出中 `Variant: release` 对应的 `Config` 应为 `release`（而非 `debug`）。

---

## 八、本项目配置速查

| 项 | 值 | 位置 |
|----|----|------|
| applicationId | `com.animalclassifier` | `android/app/build.gradle` |
| versionCode / versionName | `1` / `"1.0"` | 同上 |
| 构建架构 | 仅 `arm64-v8a` | `android/gradle.properties` |
| Hermes | 开启 | 同上 |
| 新架构 | 开启 | 同上 |
| 明文 HTTP | 允许（`usesCleartextTraffic: true`） | `android/app/build.gradle` |
| 后端地址 | `http://10.0.2.2:3000` | `src/services/api.ts` |
| JDK 路径 | Homebrew openjdk@17 | `android/gradle.properties` |

**关于架构**：`reactNativeArchitectures=arm64-v8a` 表示只编译 ARM64 原生库。
- Apple Silicon 的模拟器（arm64-v8a）和绝大多数现代真机都能直接用
- 如需支持 32 位老设备或 x86 模拟器，改成 `armeabi-v7a,arm64-v8a,x86,x86_64`，代价是包体积增大

**关于 `10.0.2.2`**：这是 Android 模拟器访问**宿主机 localhost** 的固定地址。跑任何版本前，记得本地后端要在运行（`cd server && npm run dev`）。

---

## 九、常见坑

| 现象 | 原因与解决 |
|------|-----------|
| 装 release 后 debug 版不见了 | 两者 `applicationId` 相同，互相覆盖。需共存就给其中一个加 `applicationIdSuffix`（注意：改了包名等于换了一个应用，旧版本会留在设备上） |
| release 版白屏 / 无反应 | release 不弹红屏，用 `adb logcat` 看错误；常见原因是接口地址不可达 |
| `console.log` 在 release 里看不到 | release 不连 Metro，日志走 logcat：`adb logcat \| grep ReactNative` |
| 改了代码 release 版没变化 | JS bundle 已打进 APK，必须重新构建，热重载无效 |
| `Execution failed for task ':app:...'` 找不到 Java | JDK 路径失效，检查 `org.gradle.java.home` |
| 构建报 `Duplicate resources` | 同名资源在多个 sourceSet 重复定义，检查 `src/main/res` 与 `src/debug/res` |
| 上架被拒：签名问题 | 用了 debug 签名，按第七节配置正式 keystore 后重新打包 |
| 上架被拒：明文流量 | 关闭 `usesCleartextTraffic`，后端改用 HTTPS |
| 安装包体积过大 | ① 限制 `reactNativeArchitectures`；② 打开 `enableProguardInReleaseBuilds`；③ 检查是否有未压缩的大图资源 |
| 每次上架都要改版本号 | 递增 `android/app/build.gradle` 中的 `versionCode`（整数，每次 +1），`versionName` 可读即可 |
| 首次 release 构建特别慢 | 需要跑 Hermes 编译 + JS bundle 打包，属正常；后续增量会快 |

---

## 十、上线前检查清单

- [ ] `android/app/release.keystore` 已生成，并**单独备份**（含密码）
- [ ] `android/keystore.properties` 已填好（且未提交到 Git）
- [ ] 构建日志显示 `[signing] ✓ 使用正式签名`
- [ ] `versionCode` 已递增
- [ ] `API_BASE_URL` 指向线上地址（不是 `10.0.2.2`）
- [ ] `API_TOKEN` 与服务端 `.env` 一致
- [ ] 已关闭 `usesCleartextTraffic`（若后端已上 HTTPS）
- [ ] 用 `apksigner verify --print-certs` 确认签名证书不是 `CN=Android Debug`
- [ ] 在真机上完整跑通一次主要流程（release 与 debug 行为可能不同）
