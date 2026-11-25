import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createApp } from './app.js';
import { databaseConfig, initialize, withConnection } from './database.js';
import { runStudy, saveReport } from './study.js';

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!['init', 'start', 'study'].includes(command) || (command !== 'study' && args.length)) {
    throw new Error('Dùng npm run init, npm start hoặc npm run study -- --out results');
  }
  const config = databaseConfig();

  if (command === 'init') {
    await withConnection(config, initialize);
    console.log('Đã chuẩn bị bảng và danh mục mẫu.');
  } else if (command === 'start') {
    const port = Number(process.env.APP_PORT || 8080);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('APP_PORT không hợp lệ');
    const app = createApp(config);
    const listening = once(app, 'listening');
    app.listen(port, '127.0.0.1');
    await listening;
    console.log(`API đang nghe tại http://127.0.0.1:${port}`);
  } else {
    const { values } = parseArgs({ args, options: { out: { type: 'string', default: 'results' } } });
    const report = await runStudy(config);
    const folder = await saveReport(report, resolve(values.out));
    console.log(join(folder, 'report.md'));
    console.log(join(folder, 'report.json'));
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
