#!/usr/bin/env node
'use strict';

const { execSync, spawnSync } = require('child_process');

const FRONTEND_PATHS = [
  'client/',
  'common/',
  'exts/',
  'vite.config.js',
  'scripts/generate-plugin-module.js',
  'scripts/generate-assets.js',
  'scripts/gzip-prd.js'
];

function run(command, options = {}) {
  return execSync(command, { encoding: 'utf8', ...options }).trim();
}

function getStagedFiles() {
  return run('git diff --cached --name-only --diff-filter=ACMR')
    .split('\n')
    .filter(Boolean);
}

function affectsFrontend(files) {
  return files.some(file =>
    FRONTEND_PATHS.some(prefix => file === prefix || file.startsWith(prefix))
  );
}

function main() {
  if (process.env.SKIP_STATIC_BUILD === '1') {
    return;
  }

  const staged = getStagedFiles();
  if (!affectsFrontend(staged)) {
    return;
  }

  console.log('检测到前端源码变更，正在编译静态文件...');
  const build = spawnSync('npm', ['run', 'build-client'], {
    stdio: 'inherit',
    shell: true
  });
  if (build.status !== 0) {
    process.exit(build.status || 1);
  }

  execSync('git add static/', { stdio: 'inherit' });

  const unstaged = run('git diff --name-only static/');
  if (unstaged) {
    console.error('静态文件编译后仍有未暂存变更，请检查后重试。');
    process.exit(1);
  }

  console.log('静态文件已编译并加入本次提交。');
}

main();
