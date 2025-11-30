import type { Knex } from 'knex'
import { dbFile } from './src/db'
import * as path from 'path'

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: dbFile,
    },
    migrations: {
      directory: path.resolve(__dirname, 'migrations'),
      extension: 'ts',
      tableName: 'knex_migrations',
    },
  }
}

module.exports = config;
