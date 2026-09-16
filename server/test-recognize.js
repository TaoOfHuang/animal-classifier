// Temporary diagnostic: time recognizeByImage end-to-end
require('dotenv/config');
const { recognizeByImage } = require('./dist/services/recognitionService');

const img =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const t0 = Date.now();
const tick = setInterval(
  () => console.log('...waiting', Math.round((Date.now() - t0) / 1000) + 's'),
  10000,
);

recognizeByImage({ image: img })
  .then(r => {
    clearInterval(tick);
    console.log('DONE in', Math.round((Date.now() - t0) / 1000) + 's:', JSON.stringify(r));
    process.exit(0);
  })
  .catch(e => {
    clearInterval(tick);
    console.log('ERR after', Math.round((Date.now() - t0) / 1000) + 's:', e.message);
    process.exit(1);
  });
