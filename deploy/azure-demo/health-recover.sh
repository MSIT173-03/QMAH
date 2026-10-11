#!/usr/bin/env bash
set -u
exec 9>/run/qmah-health.lock
flock -n 9 || exit 0
mkdir -p /run/qmah-health
recover() {
 local service="$1" healthy="$2" count=0
 local counter="/run/qmah-health/$service"
 if [ "$healthy" = 1 ]; then printf '0' > "$counter"; return; fi
 if [ -f "$counter" ]; then read -r count < "$counter" || true; fi
 count=$((count + 1))
 printf '%s' "$count" > "$counter"
 if [ "$count" -ge 3 ]; then
  logger -t qmah-health "$service failed three consecutive checks; restarting"
  if [ "$service" = sql ]; then docker restart qmah-sql >/dev/null; else systemctl restart "$service"; fi
  printf '0' > "$counter"
 fi
}
db_ok=0
if timeout 15 docker exec qmah-sql sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -l 5 -t 5 -Q "SELECT 1"' >/dev/null 2>&1; then db_ok=1; fi
recover sql "$db_ok"
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
