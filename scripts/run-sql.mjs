#!/usr/bin/env node
// One-off runner for supabase/*.sql against SUPABASE_DB_URL (see .env).
// Usage: node --env-file=.env scripts/run-sql.mjs supabase/schema.sql
//
// Needs the SESSION or DIRECT connection string (port 5432), not the
// transaction-mode pooler (port 6543) -- pgbouncer transaction mode doesn't
// support the multi-statement scripts this runs.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const sqlPath = process.argv[2]
if (!sqlPath) {
  console.error('usage: node --env-file=.env scripts/run-sql.mjs <path-to-sql-file>')
  process.exit(1)
}

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('SUPABASE_DB_URL is not set (see .env)')
  process.exit(1)
}

const sql = readFileSync(sqlPath, 'utf8')
const client = new pg.Client({ connectionString })

try {
  await client.connect()
  await client.query(sql)
  console.log(`ran ${sqlPath} successfully`)
} finally {
  await client.end()
}
