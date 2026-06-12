const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const prdDir = path.join(__dirname, '../static/prd');
const manifestPath = path.join(prdDir, '.vite/manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error('Vite manifest not found at', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function findChunkByName(name) {
  for (const key of Object.keys(manifest)) {
    const entry = manifest[key];
    if (entry.file && entry.file.startsWith(`${name}@`)) {
      return entry;
    }
    if (key.includes(`/${name}.`) || key.endsWith(`/${name}`)) {
      return entry;
    }
  }
  return null;
}

const indexEntry = manifest['index.js'] || findChunkByName('index');
if (!indexEntry) {
  console.error('index.js entry not found in Vite manifest');
  process.exit(1);
}

const assets = {
  manifest: { js: indexEntry.file },
  'index.js': {
    js: indexEntry.file,
    css: indexEntry.css ? indexEntry.css[0] : undefined
  }
};

['lib', 'lib2', 'lib3'].forEach(chunkName => {
  const chunk = findChunkByName(chunkName);
  if (chunk) {
    assets[chunkName] = { js: chunk.file };
  }
});

const gzFiles = [];
fs.readdirSync(prdDir).forEach(file => {
  if (file.endsWith('.gz')) {
    gzFiles.push(file);
  }
});
if (gzFiles.length) {
  assets[''] = { gz: gzFiles };
}

const output = 'window.WEBPACK_ASSETS = ' + JSON.stringify(assets) + ';\n';
fs.writeFileSync(path.join(prdDir, 'assets.js'), output);
console.log('Generated static/prd/assets.js');
