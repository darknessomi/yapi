#!/usr/bin/env bash
# YApi 性能对比：本 fork (v1.10.0) vs 原版 YMFE/yapi (v1.11.0)
# Docker 不可用时，用等效步骤测量（npm install 对应 Docker 构建核心层）
set -euo pipefail

RESULTS_DIR="${1:-/tmp/yapi-benchmark-results}"
ORIGINAL_DIR="${ORIGINAL_DIR:-/tmp/yapi-original}"
FORK_DIR="${FORK_DIR:-/workspace}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

mkdir -p "$RESULTS_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" >&2; }

elapsed() {
  local start=$1 end=$2
  awk -v s="$start" -v e="$end" 'BEGIN { printf "%.1f", e - s }'
}

dir_size_mb() {
  du -sm "$1" 2>/dev/null | awk '{print $1}'
}

count_deps() {
  node -e "
    const p=require('$1/package.json');
    console.log(Object.keys(p.dependencies||{}).length);
  "
}

# --- 1. 生产依赖安装（Dockerfile RUN npm install --omit=dev 等效）---
measure_npm_prod() {
  local dir=$1 name=$2 node_ver=$3
  log "npm install --omit=dev: $name (Node $node_ver)"
  export PATH="$HOME/.local/share/fnm:$PATH"
  if [ -f "$HOME/.local/share/fnm/fnm" ]; then
    eval "$("$HOME/.local/share/fnm/fnm" env)"
    "$HOME/.local/share/fnm/fnm" use "$node_ver" >/dev/null 2>&1 || true
  fi
  rm -rf "$dir/node_modules"
  local start end
  start=$(date +%s.%N)
  (cd "$dir" && npm install --omit=dev --registry "$NPM_REGISTRY" ${4:-} >/dev/null)
  end=$(date +%s.%N)
  local sec size
  sec=$(elapsed "$start" "$end")
  size=$(dir_size_mb "$dir/node_modules")
  echo "$sec $size"
}

# --- 2. 增量安装（仅改 package.json 后重装 vs 有 lock 缓存）---
measure_npm_reinstall() {
  local dir=$1 node_ver=${2:-20}
  log "npm 增量重装（保留 lock）: $dir (Node $node_ver)"
  export PATH="$HOME/.local/share/fnm:$PATH"
  if [ -f "$HOME/.local/share/fnm/fnm" ]; then
    eval "$("$HOME/.local/share/fnm/fnm" env)"
    "$HOME/.local/share/fnm/fnm" use "$node_ver" >/dev/null 2>&1 || true
  fi
  rm -rf "$dir/node_modules"
  local start end
  start=$(date +%s.%N)
  (cd "$dir" && npm ci --omit=dev --registry "$NPM_REGISTRY" >/dev/null 2>&1 || \
    npm install --omit=dev --registry "$NPM_REGISTRY" >/dev/null)
  end=$(date +%s.%N)
  elapsed "$start" "$end"
}

measure_vite_build() {
  log "Vite 前端构建 (fork, Node 20)"
  export PATH="$HOME/.local/share/fnm:$PATH"
  if [ -f "$HOME/.local/share/fnm/fnm" ]; then
    eval "$("$HOME/.local/share/fnm/fnm" env)"
    "$HOME/.local/share/fnm/fnm" use 20 >/dev/null 2>&1 || true
  fi
  (cd "$FORK_DIR" && npm install --registry "$NPM_REGISTRY" >/dev/null)
  rm -rf "$FORK_DIR/static/prd"
  local start end
  start=$(date +%s.%N)
  (cd "$FORK_DIR" && npm run build-client >/dev/null)
  end=$(date +%s.%N)
  local sec size
  sec=$(elapsed "$start" "$end")
  size=$(dir_size_mb "$FORK_DIR/static/prd")
  echo "$sec $size"
}

measure_ykit_build() {
  log "ykit 前端构建 (original, Node 16)"
  export PATH="$HOME/.local/share/fnm:$PATH"
  if [ -f "$HOME/.local/share/fnm/fnm" ]; then
    eval "$("$HOME/.local/share/fnm/fnm" env)"
    "$HOME/.local/share/fnm/fnm" use 16 >/dev/null 2>&1 || true
  fi
  rm -rf "$ORIGINAL_DIR/node_modules" "$ORIGINAL_DIR/static/prd"
  local start end
  start=$(date +%s.%N)
  if (cd "$ORIGINAL_DIR" && npm install --legacy-peer-deps --registry "$NPM_REGISTRY" >/dev/null 2>&1 && npm run build-client >/dev/null 2>&1); then
    end=$(date +%s.%N)
    local sec size
    sec=$(elapsed "$start" "$end")
    size=$(dir_size_mb "$ORIGINAL_DIR/static/prd" 2>/dev/null || echo "0")
    echo "$sec $size"
  else
    log "ykit 构建失败"
    echo "N/A N/A"
  fi
}

# --- 4. 单元测试 ---
measure_tests() {
  local dir=$1 cmd=$2
  log "单元测试: $cmd @ $dir"
  local start end
  start=$(date +%s.%N)
  if (cd "$dir" && eval "$cmd" >/dev/null 2>&1); then
    end=$(date +%s.%N)
    elapsed "$start" "$end"
  else
    echo "N/A"
  fi
}

# --- 5. 估算 Docker 镜像体积（base + node_modules + 源码）---
estimate_image_mb() {
  local dir=$1 node_base_mb=$2
  local nm src
  nm=$(dir_size_mb "$dir/node_modules" 2>/dev/null || echo 0)
  src=$(du -sm "$dir" --exclude=node_modules 2>/dev/null | awk '{print $1}' || dir_size_mb "$dir")
  echo $((node_base_mb + nm + src / 2))
}

# --- 6. 静态资源 gzip 对比 ---
gzip_assets_kb() {
  local dir=$1
  local js css
  js=$(find "$dir/static/prd" -name "*.js.gz" -exec stat -c%s {} + 2>/dev/null | awk '{s+=$1} END {print int(s/1024)}')
  css=$(find "$dir/static/prd" -name "*.css.gz" -exec stat -c%s {} + 2>/dev/null | awk '{s+=$1} END {print int(s/1024)}')
  echo "${js:-0} ${css:-0}"
}

log "=== YApi 性能基准测试 ==="
log "时间: $TIMESTAMP"

# Fork npm prod (Node 20)
read -r FORK_NPM_SEC FORK_NM_MB <<< "$(measure_npm_prod "$FORK_DIR" fork 20)"
FORK_NPM_RE=$(measure_npm_reinstall "$FORK_DIR" 20)
FORK_DEPS=$(count_deps "$FORK_DIR")

# Original npm prod (Node 16; 无 lockfile 时用 --legacy-peer-deps)
if [ -f "$ORIGINAL_DIR/package-lock.json" ]; then
  read -r ORIG_NPM_SEC ORIG_NM_MB <<< "$(measure_npm_prod "$ORIGINAL_DIR" original 16)"
else
  read -r ORIG_NPM_SEC ORIG_NM_MB <<< "$(measure_npm_prod "$ORIGINAL_DIR" original 16 --legacy-peer-deps)"
fi
ORIG_NPM_RE=$(measure_npm_reinstall "$ORIGINAL_DIR" 16 2>/dev/null || echo "N/A")
ORIG_DEPS=$(count_deps "$ORIGINAL_DIR")

# Frontend builds
read -r FORK_FE_SEC FORK_PRD_MB <<< "$(measure_vite_build)"
read -r ORIG_FE_SEC ORIG_PRD_MB <<< "$(measure_ykit_build)"

# Restore fork static/prd from git if we wiped it
git -C "$FORK_DIR" checkout -- static/prd 2>/dev/null || true

# Tests (fork needs config.json)
cp "$FORK_DIR/docker/config.json" "$FORK_DIR/config.json" 2>/dev/null || true
FORK_TEST=$(measure_tests "$FORK_DIR" "npm test")
rm -f "$FORK_DIR/config.json"
ORIG_TEST=$(measure_tests "$ORIGINAL_DIR" "npm test")

# Static gzip (fork prebuilt)
read -r FORK_JS_GZ FORK_CSS_GZ <<< "$(gzip_assets_kb "$FORK_DIR")"
read -r ORIG_JS_GZ ORIG_CSS_GZ <<< "$(gzip_assets_kb "$ORIGINAL_DIR")"

FORK_IMG_EST=$(estimate_image_mb "$FORK_DIR" 130)
ORIG_IMG_EST=$(estimate_image_mb "$ORIGINAL_DIR" 110)

cat > "$RESULTS_DIR/benchmark.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "environment": "native (Docker overlay unavailable in CI VM)",
  "fork": {
    "repo": "darknessomi/yapi",
    "version": "1.10.0",
    "node": "20",
    "mongo": "6",
    "build_tool": "Vite 7",
    "test_framework": "Vitest 4",
    "prod_deps_count": $FORK_DEPS,
    "npm_prod_install_sec": $FORK_NPM_SEC,
    "npm_ci_reinstall_sec": $FORK_NPM_RE,
    "node_modules_mb": $FORK_NM_MB,
    "frontend_build_sec": $FORK_FE_SEC,
    "static_prd_mb": $FORK_PRD_MB,
    "js_gzip_kb": $FORK_JS_GZ,
    "css_gzip_kb": $FORK_CSS_GZ,
    "test_sec": "$FORK_TEST",
    "docker_image_est_mb": $FORK_IMG_EST
  },
  "original": {
    "repo": "YMFE/yapi",
    "version": "1.11.0",
    "node": "7.6+ (推荐 16)",
    "mongo": "4.x",
    "build_tool": "ykit + webpack 2",
    "test_framework": "Ava",
    "prod_deps_count": $ORIG_DEPS,
    "npm_prod_install_sec": $ORIG_NPM_SEC,
    "npm_ci_reinstall_sec": $ORIG_NPM_RE,
    "node_modules_mb": $ORIG_NM_MB,
    "frontend_build_sec": "$ORIG_FE_SEC",
    "static_prd_mb": "$ORIG_PRD_MB",
    "js_gzip_kb": $ORIG_JS_GZ,
    "css_gzip_kb": $ORIG_CSS_GZ,
    "test_sec": "$ORIG_TEST",
    "docker_image_est_mb": $ORIG_IMG_EST
  }
}
EOF

cat "$RESULTS_DIR/benchmark.json"
log "完成 → $RESULTS_DIR/benchmark.json"
