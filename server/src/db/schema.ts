import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  space: text('space').notNull(),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const projectVersions = sqliteTable('project_versions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  version: integer('version').notNull(),
  snapshot: text('snapshot').notNull().default('{}'),
  createdAt: integer('created_at').notNull(),
})

export const audioFiles = sqliteTable('audio_files', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  format: text('format').notNull(),
  duration: real('duration').notNull().default(0),
  sampleRate: integer('sample_rate').notNull().default(44100),
  channels: integer('channels').notNull().default(2),
  size: integer('size').notNull().default(0),
  filePath: text('file_path').notNull(),
  projectId: text('project_id'),
  createdAt: integer('created_at').notNull(),
})

export const transcriptions = sqliteTable('transcriptions', {
  id: text('id').primaryKey(),
  audioFileId: text('audio_file_id').notNull(),
  status: text('status').notNull().default('pending'),
  scoreJson: text('score_json'),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
})
