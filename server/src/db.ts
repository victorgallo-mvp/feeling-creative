import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('railway') || config.databaseUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});

// Datas (DATE) voltam como string 'YYYY-MM-DD' em vez de Date com fuso
pg.types.setTypeParser(1082, (v) => v);

export type Queryable = pg.Pool | pg.PoolClient;

export async function query<T extends pg.QueryResultRow = any>(text: string, params: any[] = [], db: Queryable = pool) {
  const res = await db.query<T>(text, params);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = any>(text: string, params: any[] = [], db: Queryable = pool): Promise<T | null> {
  const rows = await query<T>(text, params, db);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
