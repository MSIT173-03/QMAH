#!/usr/bin/env bash
set -euo pipefail
exec 9>/run/qmah-backup.lock
flock -n 9 || exit 0
stamp=$(date -u +%F)
docker exec -u 0 qmah-sql sh -c 'mkdir -p /var/opt/mssql/backup/qmah-daily && chown 10001:0 /var/opt/mssql/backup/qmah-daily && chmod 770 /var/opt/mssql/backup/qmah-daily'
sql="BACKUP DATABASE [QMAH] TO DISK=N'/var/opt/mssql/backup/qmah-daily/QMAH-$stamp.bak' WITH COPY_ONLY,INIT,CHECKSUM; RESTORE VERIFYONLY FROM DISK=N'/var/opt/mssql/backup/qmah-daily/QMAH-$stamp.bak' WITH CHECKSUM;"
docker exec qmah-sql sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -l 10 -t 180 -Q "$1"' sh "$sql"
# Only dated backups in our dedicated folder are eligible for removal.
docker exec qmah-sql find /var/opt/mssql/backup/qmah-daily -maxdepth 1 -type f -name 'QMAH-????-??-??.bak' -mtime +6 -delete
echo "QMAH_BACKUP_OK $stamp; retention=7-days"
