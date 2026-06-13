#!/usr/bin/env bash
# Docker 性能对比：本 fork vs 原版 YMFE/yapi
set -euo pipefail

RESULTS_DIR="${1:-/tmp/yapi-benchmark-results}"
ORIGINAL_DIR="${ORIGINAL_DIR:-/tmp/yapi-original}"
FORK_DIR="${FORK_DIR:-/workspace}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$RESULTS_DIR"

log() { echo "[$(date +%H:%M:%S)] $*"; }

seconds() {
  local start=$1 end=$2
  awk -v s="$start" -v e="$end" 'BEGIN { printf "%.1f", e - s }'
}

# 为原版创建可比 Dockerfile（原版仓库无官方 Docker 方案）
create_original_dockerfile() {
  cat > "$ORIGINAL_DIR/Dockerfile.bench" <<'EOF'
FROM node:16-alpine
ENV TZ="Asia/Shanghai"
RUN apk add --no-cache python3 make g++
WORKDIR /yapi/vendors
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --omit=dev --legacy-peer-deps --registry https://registry.npmmirror.com 2>/dev/null || \
    npm install --omit=dev --legacy-peer-deps --registry https://registry.npmmirror.com
COPY . .
EXPOSE 3000
ENTRYPOINT ["node"]
EOF

  mkdir -p "$ORIGINAL_DIR/docker"
  cp "$FORK_DIR/docker/config.json" "$ORIGINAL_DIR/docker/config.json"
  cp "$FORK_DIR/docker/start.sh" "$ORIGINAL_DIR/docker/start.sh"

  cat > "$ORIGINAL_DIR/docker-compose.bench.yml" <<EOF
services:
  mongo:
    image: mongo:6
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  yapi:
    build:
      context: .
      dockerfile: Dockerfile.bench
    ports:
      - "3001:3000"
    depends_on:
      mongo:
        condition: service_healthy
    volumes:
      - ./docker/config.json:/yapi/config.json:ro
    entrypoint: ["/bin/sh", "/yapi/vendors/docker/start.sh"]
EOF
}

docker_build_time() {
  local name=$1 context=$2 dockerfile=$3
  log "Docker 冷构建: $name"
  sudo docker builder prune -f >/dev/null 2>&1 || true
  local start end
  start=$(date +%s.%N)
  sudo docker build --no-cache -t "yapi-bench-$name" -f "$dockerfile" "$context" >/dev/null
  end=$(date +%s.%N)
  seconds "$start" "$end"
}

docker_rebuild_time() {
  local name=$1 context=$2 dockerfile=$3
  log "Docker 增量重建: $name"
  echo "// bench touch $(date +%s)" >> "$context/server/app.js"
  local start end
  start=$(date +%s.%N)
  sudo docker build -t "yapi-bench-$name" -f "$dockerfile" "$context" >/dev/null
  end=$(date +%s.%N)
  git -C "$context" checkout -- server/app.js 2>/dev/null || sed -i '$ d' "$context/server/app.js"
  seconds "$start" "$end"
}

image_size_mb() {
  sudo docker images "yapi-bench-$1" --format "{{.Size}}" | head -1
}

startup_time() {
  local compose_file=$1 port=$2 project=$3
  log "启动容器: $project (port $port)"
  sudo docker compose -f "$compose_file" -p "$project" down -v >/dev/null 2>&1 || true
  local start end
  start=$(date +%s.%N)
  sudo docker compose -f "$compose_file" -p "$project" up -d --build >/dev/null
  for i in $(seq 1 120); do
    if curl -sf "http://127.0.0.1:$port/api/user/status" >/dev/null 2>&1; then
      end=$(date +%s.%N)
      echo "$(seconds "$start" "$end")"
      return 0
    fi
    sleep 1
  done
  echo "timeout"
  return 1
}

api_latency() {
  local port=$1 n=${2:-50}
  local total=0 ok=0
  for i in $(seq 1 "$n"); do
    local t
    t=$(curl -sf -o /dev/null -w "%{time_total}" "http://127.0.0.1:$port/api/user/status" 2>/dev/null || echo "fail")
    if [ "$t" != "fail" ]; then
      total=$(awk -v a="$total" -v b="$t" 'BEGIN { print a + b }')
      ok=$((ok + 1))
    fi
  done
  if [ "$ok" -gt 0 ]; then
    awk -v t="$total" -v n="$ok" 'BEGIN { printf "%.0f", (t / n) * 1000 }'
  else
    echo "N/A"
  fi
}

static_size() {
  du -sh "$1/static/prd" 2>/dev/null | awk '{print $1}'
}

npm_prod_install_time() {
  local dir=$1 name=$2
  log "npm install --omit=dev: $name"
  rm -rf "$dir/node_modules"
  local start end
  start=$(date +%s.%N)
  (cd "$dir" && npm install --omit=dev --registry https://registry.npmmirror.com >/dev/null)
  end=$(date +%s.%N)
  seconds "$start" "$end"
}

frontend_build_time() {
  local dir=$1 name=$2
  log "前端生产构建: $name"
  local start end
  start=$(date +%s.%N)
  (cd "$dir" && npm run build-client >/dev/null)
  end=$(date +%s.%N)
  seconds "$start" "$end"
}

# --- 主流程 ---
log "=== YApi Docker 性能基准测试 ==="
log "时间: $TIMESTAMP"

create_original_dockerfile

# 1. Docker 构建
FORK_COLD=$(docker_build_time fork "$FORK_DIR" "$FORK_DIR/Dockerfile")
ORIG_COLD=$(docker_build_time original "$ORIGINAL_DIR" "$ORIGINAL_DIR/Dockerfile.bench")

FORK_REBUILD=$(docker_rebuild_time fork "$FORK_DIR" "$FORK_DIR/Dockerfile")
ORIG_REBUILD=$(docker_rebuild_time original "$ORIGINAL_DIR" "$ORIGINAL_DIR/Dockerfile.bench")

FORK_SIZE=$(image_size_mb fork)
ORIG_SIZE=$(image_size_mb original)

# 2. 启动与 API 延迟
FORK_START=$(startup_time "$FORK_DIR/docker-compose.yml" 3000 "yapi-bench-fork")
ORIG_START=$(startup_time "$ORIGINAL_DIR/docker-compose.bench.yml" 3001 "yapi-bench-original")

FORK_LAT=$(api_latency 3000 50)
ORIG_LAT=$(api_latency 3001 50)

# 3. 静态资源
FORK_STATIC=$(static_size "$FORK_DIR")
ORIG_STATIC=$(static_size "$ORIGINAL_DIR")

# 4. npm 生产依赖安装（Docker 构建核心步骤）
FORK_NPM=$(npm_prod_install_time "$FORK_DIR" fork)
ORIG_NPM=$(npm_prod_install_time "$ORIGINAL_DIR" original)

# 5. 前端构建（需 devDependencies，单独测）
log "安装 devDependencies 用于前端构建对比..."
(cd "$FORK_DIR" && npm install --registry https://registry.npmmirror.com >/dev/null)
FORK_FE=$(frontend_build_time "$FORK_DIR" "fork (Vite)")

# 原版 ykit 需要 Node 16
log "原版前端构建 (ykit, Node 16)..."
ORIG_FE=$(sudo docker run --rm -v "$ORIGINAL_DIR:/src" -w /src node:16-alpine \
  sh -c 'apk add --no-cache python3 make g++ >/dev/null && npm install --legacy-peer-deps --registry https://registry.npmmirror.com >/dev/null && time npm run build-client 2>&1' \
  | grep real | awk '{print $2}' | sed 's/m/ * 60 + /; s/s//; s/0m//' | bc -l 2>/dev/null || echo "N/A")

# 输出 JSON 结果
cat > "$RESULTS_DIR/benchmark.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "fork": {
    "version": "1.10.0",
    "node": "20",
    "build_tool": "Vite 7",
    "docker_cold_build_sec": $FORK_COLD,
    "docker_rebuild_sec": $FORK_REBUILD,
    "image_size": "$FORK_SIZE",
    "startup_sec": $FORK_START,
    "api_latency_ms": $FORK_LAT,
    "static_prd_size": "$FORK_STATIC",
    "npm_prod_install_sec": $FORK_NPM,
    "frontend_build_sec": $FORK_FE
  },
  "original": {
    "version": "1.11.0",
    "node": "16",
    "build_tool": "ykit",
    "docker_cold_build_sec": $ORIG_COLD,
    "docker_rebuild_sec": $ORIG_REBUILD,
    "image_size": "$ORIG_SIZE",
    "startup_sec": $ORIG_START,
    "api_latency_ms": $ORIG_LAT,
    "static_prd_size": "$ORIG_STATIC",
    "npm_prod_install_sec": $ORIG_NPM,
    "frontend_build_sec": "$ORIG_FE"
  }
}
EOF

cat "$RESULTS_DIR/benchmark.json"

# 清理
sudo docker compose -f "$FORK_DIR/docker-compose.yml" -p yapi-bench-fork down -v >/dev/null 2>&1 || true
sudo docker compose -f "$ORIGINAL_DIR/docker-compose.bench.yml" -p yapi-bench-original down -v >/dev/null 2>&1 || true

log "结果已写入 $RESULTS_DIR/benchmark.json"
