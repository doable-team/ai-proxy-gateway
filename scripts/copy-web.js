const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '../web/dist')
const dest = path.join(__dirname, '../dist/public')

if (!fs.existsSync(src)) {
  console.error('web/dist not found — run npm run build:web first')
  process.exit(1)
}

fs.cpSync(src, dest, { recursive: true })
console.log('Copied web/dist → dist/public')
