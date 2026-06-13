import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    pool: 'forks',
    server: {
      deps: {
        inline: ['rewire']
      }
    }
  },
  resolve: {
    alias: {
      common: path.resolve(__dirname, 'common'),
      client: path.resolve(__dirname, 'client')
    }
  }
});
