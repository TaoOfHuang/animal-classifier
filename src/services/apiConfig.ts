// 接口地址配置。
//
// 单独成文件是为了**打破循环依赖**：deviceAuth 需要 API_BASE_URL 才能发注册请求，
// 而 api.ts 又需要 deviceAuth 提供令牌。两者都依赖本文件即可。
//
// 设计见 docs/plans/2026-09-18-device-token-auth.md 与 docs/02-deploy-to-tencent-cloud.md 第九节。

// 开发期地址：`10.0.2.2` 是 Android 模拟器访问「宿主机 localhost」的固定别名，
// 只在「模拟器 + 后端跑在开发机」这一种组合下有效。
// 真机（以及任何装出去的 release 包）会把它解析成手机自己的 localhost，必然连不上。
const DEV_API_BASE_URL = 'http://10.0.2.2:3000';

// TODO(deploy): 部署 server 后替换为真实域名。必须使用 https，否则 release 包
// 会被 `usesCleartextTraffic = false` 拦掉（见 android/app/build.gradle），请求直接失败。
const PROD_API_BASE_URL = 'https://api.example.com';

/**
 * 后端地址：按构建环境分流。
 *
 * 这个常量是**编译期字面量**——Metro 打包时会把它内联进 `index.android.bundle`，
 * APK 一旦打出来就改不动了，想换地址只能重新打包。
 *
 * `__DEV__` 在 release bundle 中恒为 `false`，会被静态求值，所以正式包永远落到
 * `PROD_API_BASE_URL`，不会再出现「把 10.0.2.2 打进正式包」的事故。
 */
export const API_BASE_URL = __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL;

export { DEV_API_BASE_URL, PROD_API_BASE_URL };
