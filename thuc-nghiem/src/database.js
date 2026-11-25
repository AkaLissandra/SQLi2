import mysql from 'mysql2/promise';

export const sampleCategory = "Đồ của O'Brien";

const items = [
  [1, sampleCategory, 'Gốm', 300_000],
  [2, sampleCategory, 'Khay', 250_000],
  [3, sampleCategory, 'Túi', 125_000],
  [4, 'Văn phòng', 'Khay', 80_000],
];

export function databaseConfig(env = process.env) {
  const port = Number(env.MYSQL_PORT || 3307);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MYSQL_PORT không hợp lệ');
  if (!env.MYSQL_PASSWORD) throw new Error('Cần đặt MYSQL_PASSWORD trong .env hoặc biến môi trường');

  return {
    host: env.MYSQL_HOST || '127.0.0.1',
    port,
    user: env.MYSQL_USER || 'study',
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE || 'sqli_study',
    charset: 'utf8mb4',
    multipleStatements: false,
    connectTimeout: 5_000,
  };
}

export async function initialize(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS study_items (
      item_id INT UNSIGNED PRIMARY KEY,
      category VARCHAR(64) NOT NULL,
      name VARCHAR(80) NOT NULL,
      price_dong INT UNSIGNED NOT NULL,
      INDEX (category, price_dong)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS study_searches (
      id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      category VARCHAR(64) NOT NULL,
      sort_key ENUM('name', 'price') NOT NULL,
      ceiling_dong INT UNSIGNED NULL,
      state ENUM('draft', 'published') NOT NULL,
      CHECK (ceiling_dong IS NULL OR ceiling_dong <= 100000000)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin
  `);

  for (const item of items) {
    await connection.execute(
      'INSERT INTO study_items (item_id, category, name, price_dong) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE item_id = study_items.item_id',
      item,
    );
  }
}

export async function withConnection(config, work) {
  const connection = await mysql.createConnection(config);
  try {
    await connection.query('SET SESSION autocommit = 1');
    return await work(connection);
  } finally {
    await connection.end();
  }
}
