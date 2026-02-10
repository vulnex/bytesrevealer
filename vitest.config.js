import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.js'],
    setupFiles: ['src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/services/**', 'src/stores/**'],
      exclude: ['**/*.test.js', 'src/__tests__/**']
    }
  }
}))
