#!/usr/bin/env bash
# with_lock.sh: run one heavy job (a full render, a determinism pass) at a time on a shared machine. Waits until the
# lock directory can be created, runs the command, and removes the lock on success, failure or interrupt.
#
#   bash <SKILL_DIR>/scripts/with_lock.sh [--max-wait SECONDS] -- node <SKILL_DIR>/scripts/render.mjs --scene index.html --out out/final.mp4 --scale 2
#
# RENDER_LOCK: lock directory (default ${TMPDIR:-/tmp}/motion-explainer-render.lock); every project on the machine that
# shares it takes turns. The lock holds "pid N child M since <time>: <command>" in a file named "owner". While waiting,
# a lock whose wrapper and job pids both no longer run (killed, crashed, or the machine restarted) is stale: it is
# removed with a message and the job goes ahead. --max-wait exits 3 if a live job still holds the lock that long.
# Two finals at once crashed Chrome on a 16 GB machine; checks run beside a render produced false failures.
set -uo pipefail
usage() { sed -n '2,11p' "$0"; }
case "${1:-}" in -h|--help) usage; exit 0 ;; '') usage >&2; exit 2 ;; esac
MAXW=0
if [ "$1" = "--max-wait" ]; then
  [ "$#" -ge 2 ] || { usage >&2; exit 2; }
  MAXW="$2"; shift 2
fi
case "$MAXW" in ''|*[!0-9]*) echo "error: --max-wait needs whole seconds" >&2; exit 2 ;; esac
[ "${1:-}" = "--" ] && shift
[ "$#" -gt 0 ] || { usage >&2; exit 2; }
LOCK="${RENDER_LOCK:-${TMPDIR:-/tmp}/motion-explainer-render.lock}"
LOCK="${LOCK%/}"

alive() { [ -n "$1" ] && { kill -0 "$1" 2>/dev/null || ps -p "$1" >/dev/null 2>&1; }; }
owner_pid() { sed -n 's/^pid \([0-9][0-9]*\) .*/\1/p' "$LOCK/owner" 2>/dev/null | head -1; }
owner_child() { sed -n 's/^pid [0-9][0-9]* child \([0-9][0-9]*\) .*/\1/p' "$LOCK/owner" 2>/dev/null | head -1; }

waited=0; noowner=0
until mkdir "$LOCK" 2>/dev/null; do
  pid=$(owner_pid)
  if [ -n "$pid" ]; then
    noowner=0
    if ! alive "$pid" && ! alive "$(owner_child)"; then
      sleep 1
      if [ "$(owner_pid)" = "$pid" ]; then           # unchanged: no other waiter took the lock meanwhile
        echo "removing stale lock left by pid $pid ($LOCK)"
        rm -rf "$LOCK"
      fi
      continue
    fi
  elif [ -d "$LOCK" ]; then
    noowner=$((noowner + 1))                       # created but never claimed: stale after about a minute
    if [ "$noowner" -ge 3 ]; then echo "removing stale lock with no owner ($LOCK)"; rm -rf "$LOCK"; noowner=0; continue; fi
  fi
  if [ "$MAXW" -gt 0 ] && [ "$waited" -ge "$MAXW" ]; then
    echo "error: $LOCK is still held after ${waited} s ($(cat "$LOCK/owner" 2>/dev/null || echo 'owner unknown'))" >&2
    exit 3
  fi
  if [ $((waited % 300)) -eq 0 ]; then echo "waiting for $LOCK ($(cat "$LOCK/owner" 2>/dev/null || echo 'owner unknown'))"; fi
  sleep 30; waited=$((waited + 30))
done
since=$(date '+%Y-%m-%d %H:%M:%S')
echo "pid $$ since $since: $*" > "$LOCK/owner"
child=
trap 'rm -rf "$LOCK"' EXIT
trap '[ -n "$child" ] && kill "$child" 2>/dev/null; exit 130' INT
trap '[ -n "$child" ] && kill "$child" 2>/dev/null; exit 143' TERM
"$@" &
child=$!
echo "pid $$ child $child since $since: $*" > "$LOCK/owner"
wait "$child"
