#!/usr/bin/env bash
# Join the latest locally committed island work, then verify the complete game.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

die() { printf '%s\n' "$*" >&2; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null
[[ -z "$(git ls-files -u)" ]] || die 'Resolve the existing merge before running this command.'

# The sandbox integration is stored in a bundle because this linked worktree's
# common .git is read-only there. Adopt it without checking out or deleting files.
# A separate index proves the files still exactly match the prepared commit first.
BUNDLE=${ISLAND_INTEGRATION_BUNDLE:-"$ROOT/../concepts/themes/codex-builds/integrate.bundle"}
BASE=c34d300fa5b7fbb9764e3186ddfc33cb1e58e72d
if [[ -f "$BUNDLE" ]] && [[ $(git rev-parse HEAD) == $(git rev-parse "$BASE") ]]; then
  [[ -z "$(git diff --cached --name-only)" ]] || die 'Save staged work before adopting the integration bundle.'
  git fetch --no-tags "$BUNDLE" refs/heads/int-big:refs/remotes/island-integration/prepared
  prepared=$(git rev-parse refs/remotes/island-integration/prepared)
  original=$(git rev-parse HEAD)
  branch=$(git symbolic-ref -q HEAD) || die 'Switch to an integration branch before adopting the bundle.'
  proof_index=$(mktemp "${TMPDIR:-/tmp}/ducky-integration-index.XXXXXX")
  if ! GIT_INDEX_FILE="$proof_index" git read-tree "$prepared" ||
     ! GIT_INDEX_FILE="$proof_index" git diff --quiet; then
    rm -f "$proof_index"
    die 'Working files differ from the prepared integration. Save those edits before adopting the bundle.'
  fi
  # Also protect files tracked at the old tip but removed by the integration.
  while IFS= read -r -d '' file; do
    if [[ -e "$file" ]]; then
      rm -f "$proof_index"
      die "Prepared integration removes $file, but it still exists. Review it first."
    fi
  done < <(git diff --name-only --diff-filter=D -z "$original" "$prepared")
  rm -f "$proof_index"
  git update-ref "$branch" "$prepared" "$original"
  git read-tree "$prepared"
  printf 'Adopted prepared integration %s without changing working files.\n' "$prepared"
fi

[[ -z "$(git status --porcelain)" ]] || die 'Commit or save working changes before merging island branches.'

# Default: current local branches in the common repository. An isolated Git
# directory can explicitly read the same branches from the original repository.
prefix=refs/heads/
if [[ -n ${ISLAND_SOURCE_REPO:-} ]]; then
  git fetch --no-tags "$ISLAND_SOURCE_REPO" \
    '+refs/heads/big-*:refs/remotes/island-source/big-*' \
    '+refs/heads/live-boat:refs/remotes/island-source/live-boat' \
    '+refs/heads/spread-islands:refs/remotes/island-source/spread-islands'
  prefix=refs/remotes/island-source/
fi

branches=(big-limits spread-islands big-pink big-neon big-sunflower big-community big-fair live-boat big-library big-cathedral big-canal big-waterfall big-goldmine big-bog big-snow)
tips=()
# Snapshot all refs before mutating anything; concurrent island commits wait for
# the next invocation, rather than making the verification target move mid-run.
for branch in "${branches[@]}"; do
  tip=$(git rev-parse --verify "${prefix}${branch}^{commit}") || die "Missing island branch: $branch"
  tips+=("$tip")
done
for ((i=0; i<${#branches[@]}; i++)); do
  printf '\nJoining %s at %s\n' "${branches[$i]}" "${tips[$i]}"
  if ! git merge --no-edit "${tips[$i]}"; then
    git diff --name-only --diff-filter=U
    die "Merge stopped at ${branches[$i]}. Combine the conflicting intent, commit the merge, then rerun this command. No island side was discarded."
  fi
done

port=${DUCKY_WS_PORT:-19300}
log_dir=$(mktemp -d "${TMPDIR:-/tmp}/ducky-island-checks.XXXXXX")
# Refuse to reuse or stop an unrelated server. This process owns its fixture.
DUCKY_WS_PORT="$port" node --input-type=module - <<'JS'
import net from 'node:net';
const port=Number(process.env.DUCKY_WS_PORT);
if (!Number.isInteger(port) || port<1 || port>65535) throw Error('Invalid DUCKY_WS_PORT');
const probe=net.createServer();
probe.on('error',error=>{console.error(`Fixture port ${port} unavailable: ${error.message}. Choose another DUCKY_WS_PORT.`);process.exitCode=1;});
probe.listen(port,'127.0.0.1',()=>probe.close());
JS
DUCKY_WS_PORT="$port" node server.mjs >"$log_dir/server.log" 2>&1 &
server_pid=$!
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
DUCKY_WS_PORT="$port" node --input-type=module - <<'JS'
import net from 'node:net';
import {setTimeout} from 'node:timers/promises';
let ready=false;
for(let attempt=0;attempt<100&&!ready;attempt++) {
  ready=await new Promise(resolve=>{const socket=net.connect(Number(process.env.DUCKY_WS_PORT),'127.0.0.1');socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));});
  if(!ready) await setTimeout(100);
}
if(!ready) throw Error('WebSocket test fixture did not start');
JS
DUCKY_WS_PORT="$port" npm test 2>&1 | tee "$log_dir/tests.log"
npx vite build --configLoader native 2>&1 | tee "$log_dir/build.log"
printf '\nVerified integration %s. Logs: %s\n' "$(git rev-parse HEAD)" "$log_dir"
