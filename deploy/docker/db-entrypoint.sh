#!/bin/bash
# 啟動 SQL Server，第一次啟動時還原 QMAH 資料庫
/opt/mssql/bin/sqlservr &
SQL="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $MSSQL_SA_PASSWORD -C -b"
for _ in $(seq 1 60); do $SQL -Q "SELECT 1" >/dev/null 2>&1 && break; sleep 2; done
$SQL -Q "IF DB_ID(N'QMAH') IS NULL RESTORE DATABASE [QMAH] FROM DISK=N'/backup/QMAH.bak' WITH MOVE N'QMAH' TO N'/var/opt/mssql/data/QMAH.mdf', MOVE N'QMAH_log' TO N'/var/opt/mssql/data/QMAH_log.ldf'"
wait
