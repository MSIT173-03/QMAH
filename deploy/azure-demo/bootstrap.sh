#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io caddy libicu74
systemctl enable --now docker
id qmah >/dev/null 2>&1 || useradd --system --home /var/lib/qmah --shell /usr/sbin/nologin qmah
install -d -m 700 /etc/qmah
install -d -o qmah -g qmah -m 700 /var/lib/qmah/keys
install -d -m 755 /opt/qmah
tar -xzf /home/qmahadmin/qmah-bundle.tar.gz -C /opt/qmah
install -m 644 /home/qmahadmin/restore.sql /home/qmahadmin/Caddyfile /home/qmahadmin/qmah-api.service /home/qmahadmin/qmah-web.service /home/qmahadmin/health-recover.sh /home/qmahadmin/qmah-health.service /home/qmahadmin/qmah-health.timer /opt/qmah/deploy/
install -m 600 /home/qmahadmin/api.env /etc/qmah/api.env
install -m 600 /home/qmahadmin/web.env /etc/qmah/web.env
install -m 600 /home/qmahadmin/sql.env /etc/qmah/sql.env
chmod +x /opt/qmah/api/QMAH.Api /opt/qmah/web/QMAH.Web
chown -R qmah:qmah /opt/qmah/api /opt/qmah/web /opt/qmah/QMAH.Media
chmod -R o+rX /opt/qmah/client
install -d -o 10001 -g 0 -m 770 /var/lib/qmah/sql
docker pull mcr.microsoft.com/mssql/server:2025-latest
if ! docker inspect qmah-sql >/dev/null 2>&1; then
 docker run -d --name qmah-sql --restart unless-stopped --env-file /etc/qmah/sql.env \
  -p 127.0.0.1:1433:1433 -v /var/lib/qmah/sql:/var/opt/mssql \
  -v /opt/qmah/QMAH.bak:/var/opt/mssql/backup/QMAH.bak:ro \
  --memory 3g mcr.microsoft.com/mssql/server:2025-latest >/dev/null
fi
ready=0
for attempt in $(seq 1 60); do
 if docker exec qmah-sql sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -Q "SELECT 1"' >/dev/null 2>&1; then ready=1; break; fi
 sleep 3
done
test "$ready" = 1
docker cp /opt/qmah/deploy/restore.sql qmah-sql:/tmp/restore.sql
docker exec qmah-sql sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -i /tmp/restore.sql'
docker cp /home/qmahadmin/app-login.sql qmah-sql:/tmp/app-login.sql
docker exec -u 0 qmah-sql chown 10001:0 /tmp/app-login.sql
docker exec qmah-sql sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -i /tmp/app-login.sql'
docker exec qmah-sql rm /tmp/app-login.sql
install -m 644 /opt/qmah/deploy/qmah-api.service /etc/systemd/system/
install -m 644 /opt/qmah/deploy/qmah-web.service /etc/systemd/system/
printf 'QMAH_HOST=qmah.eastus.cloudapp.azure.com\n' >/etc/qmah/caddy.env
install -d /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=/etc/qmah/caddy.env\nRestart=always\nRestartSec=5\n' >/etc/systemd/system/caddy.service.d/qmah.conf
install -m 644 /opt/qmah/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now qmah-api qmah-web
systemctl restart caddy
install -m 755 /opt/qmah/deploy/health-recover.sh /usr/local/sbin/qmah-health-recover
install -m 644 /opt/qmah/deploy/qmah-health.service /opt/qmah/deploy/qmah-health.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now qmah-health.timer
systemctl is-active qmah-api qmah-web caddy
