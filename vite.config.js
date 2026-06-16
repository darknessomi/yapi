import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';

function jsonSchemaEditorVisualEsm() {
  return {
    name: 'json-schema-editor-visual-esm',
    transform(code, id) {
      if (!id.includes('json-schema-editor-visual/package/index.js') || !code.includes('module.exports')) {
        return null;
      }
      return code.replace(/^module\.exports\s*=\s*/m, 'export default ');
    }
  };
}

function fixAntdIconInit() {
  const iconKeysPattern =
    /Object\.keys\(allIcons\)\.map\(function \(key\) \{\s*return allIcons\[key\];\s*\}\)/;

  return {
    name: 'fix-antd-icon-init',
    transform(code, id) {
      if (!id.includes('/antd/') || !id.includes('/icon/index') || !iconKeysPattern.test(code)) {
        return null;
      }
      return code.replace(
        iconKeysPattern,
        `Object.keys(allIcons).map(function (key) {
  return allIcons[key];
}).filter(function (icon) {
  return icon && typeof icon === 'object' && icon.name && icon.theme;
})`
      );
    }
  };
}

function treatJsAsJsx() {
  return {
    name: 'treat-js-files-as-jsx',
    async transform(code, id) {
      const isJsFile = id.endsWith('.js');
      if (
        !isJsFile ||
        (!/\/client\/.*\.js$/.test(id) &&
          !/\/exts\/.*\.js$/.test(id) &&
          !id.includes('json-schema-editor-visual'))
      ) {
        return null;
      }
      return transformWithEsbuild(code, id, {
        loader: 'jsx',
        jsx: 'transform'
      });
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require('./package.json');

const ACE_WORKER_FILES = ['worker-javascript.js', 'worker-json.js', 'worker-xml.js', 'worker-html.js'];
const ACE_BUILD_DIR = path.resolve(__dirname, 'node_modules/ace-builds/src-noconflict');

function aceWorkerFiles() {
  const base = '/prd/';

  function serveWorker(req, res, next) {
    const url = req.url?.split('?')[0] || '';
    const workerName = ACE_WORKER_FILES.find(
      name => url === `${base}${name}` || url === `/${name}` || url.endsWith(`/${name}`)
    );
    if (!workerName) {
      next();
      return;
    }
    res.setHeader('Content-Type', 'application/javascript');
    res.end(fs.readFileSync(path.join(ACE_BUILD_DIR, workerName)));
  }

  function copyWorkers(outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    ACE_WORKER_FILES.forEach(name => {
      fs.copyFileSync(path.join(ACE_BUILD_DIR, name), path.join(outDir, name));
    });
  }

  return {
    name: 'ace-worker-files',
    configureServer(server) {
      server.middlewares.use(serveWorker);
    },
    writeBundle(_options, _bundle) {
      copyWorkers(path.resolve(__dirname, 'static/prd'));
    }
  };
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    root: path.resolve(__dirname, 'client'),
    base: '/prd/',
    publicDir: false,
    plugins: [
      aceWorkerFiles(),
      jsonSchemaEditorVisualEsm(),
      fixAntdIconInit(),
      treatJsAsJsx(),
      commonjs({
        filter(id) {
          if (/mockEditor\.js$/.test(id)) return false;
          if (/\/client\/index\.js$/.test(id)) return false;
          if (id.includes('node_modules') && !id.includes('json-schema-editor-visual')) {
            return false;
          }
          return (
            /\/client\/.*\.js$/.test(id) ||
            /\/exts\/.*\.js$/.test(id) ||
            /\/common\/.*\.js$/.test(id)
          );
        }
      }),
      react({
        include: [/\.(js|jsx)$/, /json-schema-editor-visual/],
        babel: {
          plugins: [
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-transform-class-properties', { loose: true }]
          ]
        }
      })
    ],
    resolve: {
      alias: {
        client: path.resolve(__dirname, 'client'),
        common: path.resolve(__dirname, 'common'),
        exts: path.resolve(__dirname, 'exts'),
        'js-base64': path.resolve(__dirname, 'node_modules/js-base64/base64.js')
      }
    },
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'dev'),
      'process.env.version': JSON.stringify(pkg.version)
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true
        },
        scss: {
          silenceDeprecations: ['legacy-js-api', 'import', 'slash-div']
        }
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx'
        }
      },
      include: [
        '@toast-ui/editor',
        'swagger-client',
        'crypto-js',
        'react',
        'react-dom',
        'antd',
        'redux',
        'react-redux',
        'react-router-dom',
        'mockjs',
        'ace-builds',
        'json5',
        'axios',
        'recharts'
      ],
      needsInterop: ['json-schema-editor-visual']
    },
    server: {
      host: '127.0.0.1',
      port: 4000,
      strictPort: true,
      cors: true
    },
    build: {
      outDir: path.resolve(__dirname, 'static/prd'),
      emptyOutDir: true,
      manifest: true,
      sourcemap: false,
      rollupOptions: {
        input: path.resolve(__dirname, 'client/index.html'),
        output: {
          entryFileNames: '[name]@[hash].js',
          chunkFileNames: '[name]@[hash].js',
          assetFileNames: '[name]@[hash][extname]'
        }
      },
      commonjsOptions: {
        include: [/node_modules/, /common/, /exts/, /jsondiffpatch/],
        transformMixedEsModules: true,
        requireReturnsDefault: 'preferred',
        defaultIsModuleExports: 'auto'
      }
    }
  };
});
