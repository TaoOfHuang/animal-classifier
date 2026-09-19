// 测试环境统一使用内存库，避免在仓库里生成 data/app.sqlite。
// 各测试文件在 beforeEach 里调用 closeDb() 即可拿到一个全新的空库。
process.env.DB_PATH = ':memory:';
