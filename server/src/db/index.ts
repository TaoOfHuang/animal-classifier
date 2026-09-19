// SQLite 数据层。
//
// 使用 Node 22 内置的 `node:sqlite`（DatabaseSync），**不引入第三方依赖**。
// 选型理由与取舍见 docs/plans/2026-09-18-device-token-auth.md 第四节：
//  - 零依赖：npm 走私有 CodeArtifact 源，第三方包安装受阻（E401）
//  - 类型声明随 @types/node 提供
//  - 代价：API 标记实验性，且要求 Node >= 22.5（本项目 engines >= 22.11）
//
// 本文件是**唯一依赖具体驱动**的地方。若将来换回 better-sqlite3，
// 只需替换本文件的实现，deviceService 无需改动。

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getDbPath } from '../config';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS devices (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id    TEXT    NOT NULL UNIQUE,
  token_hash   TEXT    NOT NULL,
  whitelisted  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_devices_token_hash ON devices (token_hash);

CREATE TABLE IF NOT EXISTS usage_daily (
  device_row_id INTEGER NOT NULL,
  day           TEXT    NOT NULL,
  calls         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_row_id, day)
);

CREATE TABLE IF NOT EXISTS global_usage (
  day   TEXT    PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS register_log (
  ip         TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_register_log_ip_time ON register_log (ip, created_at);
`;

const isMemoryPath = (dbPath: string): boolean =>
  dbPath === ':memory:' || dbPath.startsWith('file::memory:');

let instance: DatabaseSync | null = null;
let openedPath: string | null = null;

const open = (dbPath: string): DatabaseSync => {
  if (!isMemoryPath(dbPath)) {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // WAL 提升读写并发；内存库没有落盘文件，设置无意义。
  if (!isMemoryPath(dbPath)) {
    db.exec('PRAGMA journal_mode = WAL');
  }
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);

  return db;
};

/**
 * 获取数据库连接（懒加载）。
 *
 * 每次调用都会重新读取 `DB_PATH`，因此测试里改了环境变量再调用即可生效；
 * 路径变化时会自动关闭旧连接。
 */
export const getDb = (): DatabaseSync => {
  const desired = getDbPath();

  if (instance && openedPath === desired) {
    return instance;
  }

  if (instance) {
    instance.close();
    instance = null;
  }

  instance = open(desired);
  openedPath = desired;
  return instance;
};

/** 关闭连接。测试在 beforeEach 里调用即可拿到全新的 `:memory:` 库 */
export const closeDb = (): void => {
  if (instance) {
    instance.close();
    instance = null;
    openedPath = null;
  }
};
