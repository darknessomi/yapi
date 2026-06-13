#!/usr/bin/env bash
# CI 入口：对比本 fork vs YMFE/yapi，输出 JSON + GitHub Step Summary
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
RESULTS_DIR="${RESULTS_DIR:-$ROOT/benchmark-results}"
ORIGINAL_DIR="${ORIGINAL_DIR:-/tmp/yapi-original}"
ORIGINAL_REPO="${ORIGINAL_REPO:-https://github.com/YMFE/yapi.git}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
export FORK_DIR="$ROOT" ORIGINAL_DIR NPM_REGISTRY RESULTS_DIR

mkdir -p "$RESULTS_DIR"

ensure_fnm() {
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
    return 0
  fi
  if [ -x "$HOME/.local/share/fnm/fnm" ]; then
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env)"
    return 0
  fi
  echo "Installing fnm..."
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$(fnm env)"
}

prepare_original() {
  if [ ! -d "$ORIGINAL_DIR/.git" ]; then
    echo "Cloning $ORIGINAL_REPO -> $ORIGINAL_DIR"
    git clone --depth 1 "$ORIGINAL_REPO" "$ORIGINAL_DIR"
  fi
  # 原版 lockfile 含失效淘宝源，benchmark 时跳过 lock 以公平对比依赖解析速度
  if [ -f "$ORIGINAL_DIR/package-lock.json" ]; then
    mv "$ORIGINAL_DIR/package-lock.json" "$ORIGINAL_DIR/package-lock.json.bench-bak"
  fi
}

write_summary() {
  local json="$RESULTS_DIR/benchmark.json"
  [ -f "$json" ] || return 0
  local summary="${GITHUB_STEP_SUMMARY:-$RESULTS_DIR/summary.md}"
  node -e "
    const d = require('$json');
    const f = d.fork, o = d.original;
    const ratio = o.npm_prod_install_sec && f.npm_prod_install_sec
      ? (o.npm_prod_install_sec / f.npm_prod_install_sec).toFixed(1) : 'N/A';
    const fmt = (v) => (typeof v === 'number' ? v : String(v));
    const lines = [
      '## YApi 性能对比（CI）',
      '',
      '| 指标 | 本 fork | 原版 YMFE/yapi |',
      '|------|---------|----------------|',
      '| 版本 | ' + f.version + ' | ' + o.version + ' |',
      '| npm install --omit=dev | **' + fmt(f.npm_prod_install_sec) + ' s** | ' + fmt(o.npm_prod_install_sec) + ' s |',
      '| npm ci 重装 | **' + fmt(f.npm_ci_reinstall_sec) + ' s** | ' + fmt(o.npm_ci_reinstall_sec) + ' |',
      '| 生产依赖数 | **' + f.prod_deps_count + '** | ' + o.prod_deps_count + ' |',
      '| 前端构建 | **' + fmt(f.frontend_build_sec) + ' s** (' + f.build_tool + ') | ' + fmt(o.frontend_build_sec) + ' (' + o.build_tool + ') |',
      '| 单元测试 | **' + fmt(f.test_sec) + ' s** | ' + fmt(o.test_sec) + ' |',
      '| node_modules | ' + f.node_modules_mb + ' MB | ' + o.node_modules_mb + ' MB |',
    ];
    if (f.docker_cold_build_sec) {
      lines.push('| Docker 冷构建 | **' + f.docker_cold_build_sec + ' s** | ' + (o.docker_cold_build_sec || 'N/A') + ' |');
      lines.push('| Docker 增量重建 | **' + f.docker_rebuild_sec + ' s** | ' + (o.docker_rebuild_sec || 'N/A') + ' |');
      lines.push('| 容器启动 | **' + f.startup_sec + ' s** | ' + (o.startup_sec || 'N/A') + ' |');
      lines.push('| API 延迟 | **' + f.api_latency_ms + ' ms** | ' + (o.api_latency_ms || 'N/A') + ' |');
    }
    lines.push('', '生产依赖安装快约 **' + ratio + '×**。', '', '环境: ' + (d.environment || 'CI'));
    require('fs').writeFileSync('$summary', lines.join('\n') + '\n');
  "
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ] && [ -f "$RESULTS_DIR/summary.md" ]; then
    cat "$RESULTS_DIR/summary.md" >> "$GITHUB_STEP_SUMMARY"
  fi
  cat "$RESULTS_DIR/summary.md" 2>/dev/null || true
}

echo "=== benchmark-ci: fork=$FORK_DIR original=$ORIGINAL_DIR ==="
ensure_fnm
fnm install 16
fnm install 20
prepare_original

"$ROOT/scripts/benchmark-native.sh" "$RESULTS_DIR"

# Docker 对比（GHA ubuntu-latest 通常可用；失败不阻断）
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "=== Docker benchmark ==="
  if "$ROOT/scripts/benchmark-docker.sh" "$RESULTS_DIR" 2>"$RESULTS_DIR/docker.log"; then
    node -e "
      const fs = require('fs');
      const native = JSON.parse(fs.readFileSync('$RESULTS_DIR/benchmark.json','utf8'));
      const docker = JSON.parse(fs.readFileSync('$RESULTS_DIR/benchmark-docker.json','utf8'));
      native.environment = process.env.GITHUB_ACTIONS ? 'GitHub Actions ubuntu-latest' : 'local+docker';
      native.fork = { ...native.fork, ...docker.fork };
      native.original = { ...native.original, ...docker.original };
      fs.writeFileSync('$RESULTS_DIR/benchmark.json', JSON.stringify(native, null, 2));
    "
  else
    echo "Docker benchmark skipped (see $RESULTS_DIR/docker.log)"
  fi
else
  echo "Docker not available, native only"
fi

write_summary
echo "Results: $RESULTS_DIR/benchmark.json"
