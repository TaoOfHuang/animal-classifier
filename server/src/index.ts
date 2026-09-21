import 'dotenv/config';
import { app } from './app';
import { assertConservationConfig, getDbPath, getPort } from './config';
import { closeDb, getDb } from './db';
import { logger } from './utils/logger';

const port = getPort(process.env.PORT);

// 配置非法就起不来；token 缺失只告警（不阻断）。
assertConservationConfig();

// 提前建表：数据库路径非法或不可写时直接启动失败，而不是等第一个请求才暴露。
getDb();

const server = app.listen(port, () => {
  logger.info('server', `listening on ${port}`);
  logger.info('server', `SQLite ready at ${getDbPath()}`);
});

// ── 优雅退出 ───────────────────────────────────────────────────────────
// 为什么必须做：SQLite 在 WAL 模式下，最后一次 checkpoint 只发生在连接真正
// close() 的时候。进程被直接杀掉会留下体积持续增长的 `app.sqlite-wal`，
// 主库文件长期停在初始页数（数据不会丢——下次打开会自动重放 WAL——但
// 备份、外部工具直读主库都会踩坑）。
//
// 关闭顺序不可颠倒：先让 server 排空在途请求，再关库。
// 反过来会让正在处理的请求拿到已关闭的连接。

/** 排空上限：keep-alive 连接可能让 server.close() 迟迟不回调，到点强制退出 */
const DRAIN_TIMEOUT_MS = 5000;

let shuttingDown = false;

const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) {
    // 第二次信号（连按两次 Ctrl-C、或 pm2 强杀）：不再等待
    logger.warn('server', `${signal} received again, exiting now`);
    closeDb();
    process.exit(1);
  }
  shuttingDown = true;

  logger.info('server', `${signal} received, draining connections...`);

  const forceExit = setTimeout(() => {
    logger.warn(
      'server',
      `drain timed out after ${DRAIN_TIMEOUT_MS}ms, forcing exit`,
    );
    // closeDb() 是同步的（node:sqlite 的 DatabaseSync），放在 exit 之前是安全的
    closeDb();
    process.exit(1);
  }, DRAIN_TIMEOUT_MS);

  server.close(() => {
    clearTimeout(forceExit);
    // 请求已排空，此时关库才会触发 WAL checkpoint 并清掉 -wal / -shm
    closeDb();
    logger.info('server', 'closed cleanly');
    process.exit(0);
  });

  // 主动掐断已空闲的 keep-alive 连接，否则 close() 要等满 keepAliveTimeout 才回调
  server.closeIdleConnections();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
