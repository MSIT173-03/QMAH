#!/usr/bin/env bash
set -Eeuo pipefail
# Runs on the Azure VM: back up QMAH first, then apply the idempotent upgrade/seed scripts in order.
# Usage: apply-database-updates.sh <directory containing the .sql files> <file> [<file>...]
dir="${1:?SQL directory required}"; shift
exec 9>/run/qmah-backup.lock
flock -w 600 9
stamp=$(date -u +%Y%m%dT%H%M%S)
docker exec -u 0 qmah-sql sh -c 'mkdir -p /var/opt/mssql/backup/pre-release && chown 10001:0 /var/opt/mssql/backup/pre-release && chmod 770 /var/opt/mssql/backup/pre-release'
sqlrun() { docker exec qmah-sql sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -I -f 65001 "$@"' sh "$@"; }
sqlrun -Q "BACKUP DATABASE [QMAH] TO DISK=N'/var/opt/mssql/backup/pre-release/QMAH-$stamp.bak' WITH COPY_ONLY,INIT,CHECKSUM; RESTORE VERIFYONLY FROM DISK=N'/var/opt/mssql/backup/pre-release/QMAH-$stamp.bak' WITH CHECKSUM;"
echo "QMAH_DB_BACKUP_OK $stamp"
for file in "$@"; do
    if [ "$(basename "$file")" = store-sold-topup.sql ]; then
        existing=$(sqlrun -d QMAH -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM store.StoreOrders WHERE OrderNo LIKE 'QMAH-TOPUP-%';" | tr -d '[:space:]')
        if [ "$existing" != 0 ]; then
            echo "Purchase top-up already applied: $existing orders; preserving them"
            continue
        fi
    fi
    docker cp "$dir/$file" "qmah-sql:/tmp/$(basename "$file")"
    echo "== applying $file"
    sqlrun -d QMAH -i "/tmp/$(basename "$file")"
    docker exec -u 0 qmah-sql rm -f "/tmp/$(basename "$file")"
done
sqlrun -d QMAH -h -1 -W -Q "SET NOCOUNT ON; SELECT 'point_exchange_coupons=' + CAST(COUNT(*) AS varchar(10)) FROM store.CouponDefinitions WHERE AcquisitionType=N'POINT_EXCHANGE'; SELECT 'ai_review_tables=' + CAST(COUNT(*) AS varchar(10)) FROM sys.tables WHERE name IN (N'AiReviewLogs', N'AiReviewRuntimeStatus');"
echo "QMAH_DB_OK $stamp"
