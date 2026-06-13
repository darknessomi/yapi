#!/usr/bin/env bash
# Docker 性能对比：本 fork vs 原版 YMFE/yapi
set -euo pipefail

RESULTS_DIR="${1:-benchmark-results}"
ORIGINAL_DIR="${ORIGINAL_DIR:-/tmp/yapi-original}"
FORK_DIR="${FORK_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
DOCKER="${DOCKER:-docker}"

mkdir -p "$RESULTS_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" >&2; }

seconds() {
  awk -v s="$1" -v e="$2" 'BEGIN { printf "%.1f", e - s }'
}

create_original_dockerfile() {
  cat > "$ORIGINAL_DIR/Dockerfile.bench" <<EOF
FROM node:16-alpine
ENV TZ="Asia/Shanghai"
RUN apk add --no-cache python3 make g++
WORKDIR /yapi/vendors
COPY package.json .npmrc* ./
RUN npm install --omit=dev --legacy-peer-deps --registry $NPM_REGISTRY
COPY . .
EXPOSE 3000
ENTRYPOINT ["node"]
EOF

  mkdir -p "$ORIGINAL_DIR/docker"
  cp "$FORK_DIR/docker/config.json" "$ORIGINAL_DIR/docker/config.json"
  cp "$FORK_DIR/docker/start.sh" "$ORIGINAL_DIR/docker/start.sh"

  cat > "$ORIGINAL_DIR/docker-compose.bench.yml" <<'EOF'
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
  local name=$1 context=$2 dockerfile=$3 nocache=${4:-}
  log "Docker 构建: $name (no-cache=$nocache)"
  local start end
  start=$(date +%s.%N)
  $DOCKER build $nocache -t "yapi-bench-$name" -f "$dockerfile" "$context" >/dev/null
  end=$(date +%s.%N)
  seconds "$start" "$end"
}

image_size() {
  $DOCKER images "yapi-bench-$1" --format "{{.Size}}" | head -1
}

startup_time() {
  local compose_file=$1 port=$2 project=$3
  log "容器启动: $project"
  $DOCKER compose -f "$compose_file" -p "$project" down -v >/dev/null 2>&1 || true
  local start end
  start=$(date +%s.%N)
  $DOCKER compose -f "$compose_file" -p "$project" up -d --build >/dev/null
  for _ in $(seq 1 120); do
    if curl -sf "http://127.0.0.1:$port/api/user/status" >/dev/null 2>&1; then
      end=$(date +%s.%N)
      seconds "$start" "$end"
      return 0
    fi
    sleep 1
  done
  echo "timeout"
  return 1
}

api_latency_ms() {
  local port=$1 n=${2:-30}
  local total=0 ok=0 t
  for _ in $(seq 1 "$n"); do
    t=$(curl -sf -o /dev/null -w "%{time_total}" "http://127.0.0.1:$port/api/user/status" 2>/dev/null || echo fail)
    if [ "$t" != "fail" ]; then
      total=$(awk -v a="$total" -v b="$t" 'BEGIN { print a + b }')
      ok=$((ok + 1))
    fi
  done
  [ "$ok" -gt 0 ] && awk -v t="$total" -v n="$ok" 'BEGIN { printf "%.0f", (t / n) * 1000 }' || echo "N/A"
}

log "=== Docker 性能基准测试 ==="
create_original_dockerfile

FORK_COLD=$(docker_build_time fork "$FORK_DIR" "$FORK_DIR/Dockerfile" --no-cache)
ORIG_COLD=$(docker_build_time original "$ORIGINAL_DIR" "$ORIGINAL_DIR/Dockerfile.bench" --no-cache)

echo "// bench $(date +%s)" >> "$FORK_DIR/server/app.js"
FORK_REBUILD=$(docker_build_time fork "$FORK_DIR" "$FORK_DIR/Dockerfile" "")
git -C "$FORK_DIR" checkout -- server/app.js 2>/dev/null || sed -i '$ d' "$FORK_DIR/server/app.js"

echo "// bench $(date +%s)" >> "$ORIGINAL_DIR/server/app.js"
ORIG_REBUILD=$(docker_build_time original "$ORIGINAL_DIR" "$ORIGINAL_DIR/Dockerfile.bench" "")
git -C "$ORIGINAL_DIR" checkout -- server/app.js 2>/dev/null || sed -i '$ d' "$ORIGINAL_DIR/server/app.js"

FORK_SIZE=$(image_size fork)
ORIG_SIZE=$(image_size original)

FORK_START=$(startup_time "$FORK_DIR/docker-compose.yml" 3000 "yapi-bench-fork")
ORIG_START=$(startup_time "$ORIGINAL_DIR/docker-compose.bench.yml" 3001 "yapi-bench-original")

FORK_LAT=$(api_latency_ms 3000)
ORIG_LAT=$(api_latency_ms 3001)

$DOCKER compose -f "$FORK_DIR/docker-compose.yml" -p yapi-bench-fork down -v >/dev/null 2>&1 || true
$DOCKER compose -f "$ORIGINAL_DIR/docker-compose.bench.yml" -p yapi-bench-original down -v >/dev/null 2>&1 || true

cat > "$RESULTS_DIR/benchmark-docker.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "fork": {
    "docker_cold_build_sec": $FORK_COLD,
    "docker_rebuild_sec": $FORK_REBUILD,
    "image_size": "$FORK_SIZE",
    "startup_sec": $FORK_START,
    "api_latency_ms": $FORK_LAT
  },
  "original": {
    "docker_cold_build_sec": $ORIG_COLD,
    "docker_rebuild_sec": $ORIG_REBUILD,
    "image_size": "$ORIG_SIZE",
    "startup_sec": $ORIG_START,
    "api_latency_ms": $ORIG_LAT
  }
}
EOF

cat "$RESULTS_DIR/benchmark-docker.json"
log "完成 → $RESULTS_DIR/benchmark-docker.json"
