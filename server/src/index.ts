import 'dotenv/config';
import { app } from './app';
import { getPort } from './config';

const port = getPort(process.env.PORT);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on ${port}`);
});
