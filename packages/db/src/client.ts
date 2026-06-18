import { Pool } from '@neondatabase/serverless'
import { loadLocalEnv, requiredEnv } from '@called-it/core/env'

loadLocalEnv()

export const pool = new Pool({ connectionString: requiredEnv('DATABASE_URL') })

export async function query<T = any>(text: string, params: any[] = []) {
  return pool.query(text, params) as unknown as Promise<{ rows: T[] }>
}

export async function withTransaction<T>(fn: (client: { query: typeof pool.query }) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client as any)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function serializeRow<T extends Record<string, any>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  ) as T
}
