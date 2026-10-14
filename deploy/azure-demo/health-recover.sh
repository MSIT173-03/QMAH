#!/usr/bin/env bash
set -uo pipefail
run_dir="${QMAH_RUN_DIR:-/run}"
# Wait-free reader lock: an active deployment owns this lock exclusively.
# This also lets deployment wait for a health check that is already running.
exec 8>"${QMAH_UPDATE_LOCK:-/var/lock/qmah-update.lock}" || exit 1
flock -s -n 8 || exit 0
state="$run_dir/qmah-health"
mkdir -p "$state" || exit 1
exec 9>"$run_dir/qmah-health.lock"
flock -n 9 || exit 0
recover() {
 local service="$1" healthy="$2" count=0 last=0 now
 local counter="$state/$service"
 if [ "$healthy" = 1 ]; then printf '0' > "$counter"; return; fi
 if [ -f "$counter" ]; then read -r count < "$counter" || true; fi
 # A partial/corrupt counter must not disable every subsequent health check.
 [[ "$count" =~ ^[0-9]{1,3}$ ]] || count=0
 count=$((10#$count))
 count=$((count + 1))
 (( count > 999 )) && count=999
 printf '%s' "$count" > "$counter"
 if [ "$count" -ge 3 ]; then
  now=$(date +%s)
  if [ -f "$state/$service.last-attempt" ]; then read -r last < "$state/$service.last-attempt" || true; fi
  [[ "$last" =~ ^[0-9]{1,12}$ ]] || last=0
  last=$((10#$last))
  # Give a restarting SQL Server time to recover; retry failed restarts later.
  if (( now >= last && now - last < 300 )); then return; fi
  printf '%s' "$now" > "$state/$service.last-attempt"
  logger -t qmah-health "$service failed consecutive checks; attempting recovery"
  local restarted=0
  if [ "$service" = sql ]; then
   timeout 45 docker restart qmah-sql >/dev/null 2>&1 && restarted=1
  else
   timeout 45 systemctl restart "$service" >/dev/null 2>&1 && restarted=1
  fi
  if [ "$restarted" = 1 ]; then
   printf '0' > "$counter"
   logger -t qmah-health "$service recovery started; next check will verify readiness"
  else
   logger -t qmah-health "$service recovery failed; failure count retained for retry"
  fi
 fi
}
docker_ok=0
if timeout 5 docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then docker_ok=1; fi
# Recover the daemon too: docker restart cannot work if the daemon has stopped.
recover docker "$docker_ok"
db_ok=0
if [ "$docker_ok" = 1 ]; then
 if timeout 15 docker exec qmah-sql sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -l 5 -t 5 -d QMAH -Q "SET NOCOUNT ON; SELECT TOP (1) Id FROM [catalog].[Artifacts]; SELECT TOP (1) Id FROM [user].[AspNetUsers];"' >/dev/null 2>&1; then db_ok=1; fi
 recover sql "$db_ok"
fi
# 資料庫故障時先恢復資料庫，避免重啟正常等待資料庫的應用程式。
if [ "$db_ok" = 1 ]; then
 api_ok=0
 if curl -fsS --max-time 15 -H 'Host: qmah.eastus.cloudapp.azure.com' -H 'X-Forwarded-Proto: https' 'http://127.0.0.1:5101/api/v1/catalog/artifacts?pageSize=1' >/dev/null; then api_ok=1; fi
 recover qmah-api "$api_ok"
 web_ok=0
 if curl -fsS --max-time 15 -H 'Host: qmah.eastus.cloudapp.azure.com' -H 'X-Forwarded-Proto: https' 'http://127.0.0.1:5102/admin/Account/Login' >/dev/null; then web_ok=1; fi
 recover qmah-web "$web_ok"
fi
proxy_ok=0
if curl -fsS --max-time 15 --resolve 'qmah.eastus.cloudapp.azure.com:443:127.0.0.1' 'https://qmah.eastus.cloudapp.azure.com/' >/dev/null; then proxy_ok=1; fi
recover caddy "$proxy_ok"
printf '%s' "$(date +%s)" > "$state/last-completed"
