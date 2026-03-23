import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: false,
  minify: false,
  noExternal: [],
  external: [],
  esbuildOptions(options) {
    options.define = options.define || {}
    // Preserve node: protocol imports
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
})
