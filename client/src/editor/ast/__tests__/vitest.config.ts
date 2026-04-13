/**
 * Minimal Vitest config for the AST unit tests.
 *
 * Runs without JSDOM and without the heavy @testing-library/jest-dom setup
 * so these pure-TypeScript tests don't OOM on the setup phase.
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../../src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
    // No setupFiles — AST tests are pure TS, no DOM APIs needed
  },
})
