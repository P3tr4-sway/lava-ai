import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { config } from '../config/index.js'
import * as schema from './schema.js'

function createDb() {
  const dbPath = config.databaseUrl
  mkdirSync(dirname(dbPath), { recursive: true })

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  // Run inline migrations for dev simplicity
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      space TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audio_files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      format TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 0,
      sample_rate INTEGER NOT NULL DEFAULT 44100,
      channels INTEGER NOT NULL DEFAULT 2,
      size INTEGER NOT NULL DEFAULT 0,
      file_path TEXT NOT NULL,
      project_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcriptions (
      id TEXT PRIMARY KEY,
      audio_file_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      score_json TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `)

  return db
}

export const db = createDb()
