import 'dotenv/config';
import { app } from './app';
import { assertConservationConfig, getDbPath, getPort } from './config';
import { getDb } from './db';

const port = getPort(process.env.PORT);

// 配置非法就起不来；token 缺失只告警（不阻断）。
assertConservationConfig();

// 提前建表：数据库路径非法或不可写时直接启动失败，而不是等第一个请求才暴露。
getDb();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on ${port}`);
  // eslint-disable-next-line no-console
  console.log(`SQLite ready at ${getDbPath()}`);
});
