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

let nullableConfig = null;
try {
  nullableConfig = require('./config.json');
} catch (ignore) {
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    root: path.resolve(__dirname, 'client'),
    base: '/prd/',
    publicDir: false,
    plugins: [
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
        axios: path.resolve(__dirname, 'node_modules/axios/dist/axios.js'),
        events: path.resolve(__dirname, 'common/events-shim.js'),
        'json-schema-editor-visual': path.resolve(
          __dirname,
          'node_modules/json-schema-editor-visual/package/index.js'
        )
      },
      extensions: ['.js', '.jsx', '.json']
    },
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'dev'),
      'process.env.version': JSON.stringify(pkg.version),
      'process.env.versionNotify': JSON.stringify(
        nullableConfig && nullableConfig.versionNotify ? nullableConfig.versionNotify : ''
      )
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
    esbuild: {
      loader: 'jsx',
      include: /\.js$/
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
      cssCodeSplit: true,
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
