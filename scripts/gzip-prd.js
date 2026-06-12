const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const prdDir = path.join(__dirname, '../static/prd');
const threshold = 10240;

fs.readdirSync(prdDir).forEach(file => {
  if (!/\.(js|css)$/.test(file)) return;
  const filePath = path.join(prdDir, file);
  const stat = fs.statSync(filePath);
  if (stat.size < threshold) return;

  const content = fs.readFileSync(filePath);
  const gzipped = zlib.gzipSync(content, { level: 9 });
  const ratio = gzipped.length / content.length;
  if (ratio <= 0.8) {
    fs.writeFileSync(filePath + '.gz', gzipped);
    console.log(`gzipped ${file} (${(ratio * 100).toFixed(1)}%)`);
  }
});
