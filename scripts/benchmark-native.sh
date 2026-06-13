#!/usr/bin/env bash
# YApi 性能对比：本 fork vs 原版 YMFE/yapi
set -euo pipefail

RESULTS_DIR="${1:-benchmark-results}"
ORIGINAL_DIR="${ORIGINAL_DIR:-/tmp/yapi-original}"
FORK_DIR="${FORK_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"

mkdir -p "$RESULTS_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" >&2; }

elapsed() {
  awk -v s="$1" -v e="$2" 'BEGIN { printf "%.1f", e - s }'
}

dir_size_mb() {
  du -sm "$1" 2>/dev/null | awk '{print $1}'
}

count_deps() {
  node -e "console.log(Object.keys(require('$1/package.json').dependencies||{}).length)"
}

use_node() {
  local ver=$1
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
    fnm use "$ver" >/dev/null 2>&1 || fnm install "$ver" && fnm use "$ver" >/dev/null
  fi
}

measure_npm_prod() {
  local dir=$1 name=$2 node_ver=$3
  shift 3
  log "npm install --omit=dev: $name (Node $node_ver)"
  use_node "$node_ver"
  rm -rf "$dir/node_modules"
  local start end
  start=$(date +%s.%N)
  (cd "$dir" && npm install --omit=dev --registry "$NPM_REGISTRY" "$@" >/dev/null)
  end=$(date +%s.%N)
  echo "$(elapsed "$start" "$end") $(dir_size_mb "$dir/node_modules")"
}

measure_npm_reinstall() {
  local dir=$1 node_ver=$2
  log "npm ci --omit=dev: $dir (Node $node_ver)"
  use_node "$node_ver"
  rm -rf "$dir/node_modules"
  local start end
  start=$(date +%s.%N)
  if [ -f "$dir/package-lock.json" ]; then
    (cd "$dir" && npm ci --omit=dev --registry "$NPM_REGISTRY" >/dev/null)
  else
    (cd "$dir" && npm install --omit=dev --registry "$NPM_REGISTRY" >/dev/null)
  fi
  end=$(date +%s.%N)
  elapsed "$start" "$end"
}

measure_vite_build() {
  log "Vite 前端构建 (fork, Node 20)"
  use_node 20
  (cd "$FORK_DIR" && npm install --registry "$NPM_REGISTRY" >/dev/null)
  rm -rf "$FORK_DIR/static/prd"
  local start end
  start=$(date +%s.%N)
  (cd "$FORK_DIR" && npm run build-client >/dev/null)
  end=$(date +%s.%N)
  echo "$(elapsed "$start" "$end") $(dir_size_mb "$FORK_DIR/static/prd")"
}

measure_ykit_build() {
  log "ykit 前端构建 (original, Node 16)"
  use_node 16
  rm -rf "$ORIGINAL_DIR/node_modules"
  local start end status=0
  start=$(date +%s.%N)
  (cd "$ORIGINAL_DIR" && npm install --legacy-peer-deps --registry "$NPM_REGISTRY" >/dev/null 2>&1 && npm run build-client >/dev/null 2>&1) || status=1
  end=$(date +%s.%N)
  if [ "$status" -eq 0 ]; then
    echo "$(elapsed "$start" "$end") $(dir_size_mb "$ORIGINAL_DIR/static/prd" 2>/dev/null || echo 0)"
  else
    log "ykit 构建失败（node-sass 等依赖已无法在现代 Node 编译）"
    echo "failed failed"
  fi
}

measure_tests() {
  local dir=$1 node_ver=$2 setup=$3
  log "单元测试: $dir (Node $node_ver)"
  use_node "$node_ver"
  eval "$setup" >/dev/null 2>&1 || true
  local start end
  start=$(date +%s.%N)
  (cd "$dir" && npm test >/dev/null 2>&1) || true
  end=$(date +%s.%N)
  elapsed "$start" "$end"
}

gzip_assets_kb() {
  local dir=$1
  local js css
  js=$(find "$dir/static/prd" -name "*.js.gz" -exec stat -c%s {} + 2>/dev/null | awk '{s+=$1} END {print int(s/1024)+0}')
  css=$(find "$dir/static/prd" -name "*.css.gz" -exec stat -c%s {} + 2>/dev/null | awk '{s+=$1} END {print int(s/1024)+0}')
  echo "${js:-0} ${css:-0}"
}

FORK_VERSION=$(node -e "console.log(require('$FORK_DIR/package.json').version)")
ORIG_VERSION=$(node -e "console.log(require('$ORIGINAL_DIR/package.json').version)" 2>/dev/null || echo "1.11.0")

log "=== YApi 性能基准测试 ==="
log "fork=$FORK_DIR original=$ORIGINAL_DIR"

read -r FORK_NPM_SEC FORK_NM_MB <<< "$(measure_npm_prod "$FORK_DIR" fork 20)"
FORK_NPM_RE=$(measure_npm_reinstall "$FORK_DIR" 20)
FORK_DEPS=$(count_deps "$FORK_DIR")

read -r ORIG_NPM_SEC ORIG_NM_MB <<< "$(measure_npm_prod "$ORIGINAL_DIR" original 16 --legacy-peer-deps)"
ORIG_NPM_RE="N/A"
ORIG_DEPS=$(count_deps "$ORIGINAL_DIR")

read -r FORK_FE_SEC FORK_PRD_MB <<< "$(measure_vite_build)"
read -r ORIG_FE_SEC ORIG_PRD_MB <<< "$(measure_ykit_build)"

git -C "$FORK_DIR" checkout -- static/prd 2>/dev/null || true

FORK_TEST=$(measure_tests "$FORK_DIR" 20 "cp '$FORK_DIR/docker/config.json' '$FORK_DIR/config.json'")
rm -f "$FORK_DIR/config.json"
ORIG_TEST=$(measure_tests "$ORIGINAL_DIR" 16 "")

read -r FORK_JS_GZ FORK_CSS_GZ <<< "$(gzip_assets_kb "$FORK_DIR")"

json_val() {
  if [[ "$1" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then echo "$1"; else echo "\"$1\""; fi
}

FORK_TEST_JSON=$(json_val "$FORK_TEST")
ORIG_FE_JSON=$([ "$ORIG_FE_SEC" = "failed" ] && echo '"failed (node-sass/ykit)"' || json_val "$ORIG_FE_SEC")
ORIG_PRD_JSON=$([ "$ORIG_PRD_MB" = "failed" ] && echo '"N/A"' || json_val "$ORIG_PRD_MB")
ORIG_TEST_JSON=$([ "$ORIG_TEST" = "failed" ] && echo '"failed"' || json_val "$ORIG_TEST")

cat > "$RESULTS_DIR/benchmark.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "environment": "${CI:-local}",
  "fork": {
    "repo": "darknessomi/yapi",
    "version": "$FORK_VERSION",
    "node": "20",
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
    "test_sec": $FORK_TEST_JSON
  },
  "original": {
    "repo": "YMFE/yapi",
    "version": "$ORIG_VERSION",
    "node": "16",
    "build_tool": "ykit + webpack 2",
    "test_framework": "Ava",
    "prod_deps_count": $ORIG_DEPS,
    "npm_prod_install_sec": $ORIG_NPM_SEC,
    "npm_ci_reinstall_sec": "$ORIG_NPM_RE",
    "node_modules_mb": $ORIG_NM_MB,
    "frontend_build_sec": $ORIG_FE_JSON,
    "static_prd_mb": $ORIG_PRD_JSON,
    "js_gzip_kb": 0,
    "css_gzip_kb": 0,
    "test_sec": $ORIG_TEST_JSON
  }
}
EOF

cat "$RESULTS_DIR/benchmark.json"
log "完成 → $RESULTS_DIR/benchmark.json"
