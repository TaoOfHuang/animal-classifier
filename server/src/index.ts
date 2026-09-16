import 'dotenv/config';
import { app } from './app';
import { assertConservationConfig, getPort } from './config';

const port = getPort(process.env.PORT);

// 配置非法就起不来；token 缺失只告警（不阻断）。
assertConservationConfig();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on ${port}`);
});
