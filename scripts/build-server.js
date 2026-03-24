const { build } = require('esbuild')
const path = require('path')

build({
  entryPoints: [path.join(__dirname, '../src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: path.join(__dirname, '../dist/index.js'),
  banner: { js: '#!/usr/bin/env node' },
  external: ['node:*', 'node:sqlite', 'open'],
}).then(() => {
  console.log('dist/index.js built')
}).catch(e => {
  console.error(e.message)
  process.exit(1)
})
