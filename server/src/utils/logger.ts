// Minimal timestamped logger so recognition requests can be traced end-to-end
// in the terminal where `npm run start` runs.
const ts = (): string => new Date().toISOString().slice(11, 23);

export const logger = {
  info: (scope: string, message: string): void => {
    // eslint-disable-next-line no-console
    console.log(`[${ts()}] [${scope}] ${message}`);
  },
  warn: (scope: string, message: string): void => {
    // eslint-disable-next-line no-console
    console.warn(`[${ts()}] [${scope}] ${message}`);
  },
  error: (scope: string, message: string): void => {
    // eslint-disable-next-line no-console
    console.error(`[${ts()}] [${scope}] ${message}`);
  },
};
