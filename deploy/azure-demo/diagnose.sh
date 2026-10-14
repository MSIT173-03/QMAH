#!/usr/bin/env bash
set -uo pipefail
# Read-only operational checks. Never print environment files or credentials.
echo 'QMAH_DIAGNOSTICS_BEGIN'
if [[ -f /opt/qmah/current-revision ]]; then
    revision=$(cat /opt/qmah/current-revision)
    [[ "$revision" =~ ^[0-9a-f]{40}$ ]] && echo "Revision: $revision"
fi
echo 'Service state'
systemctl is-active qmah-api qmah-web caddy docker qmah-health.timer qmah-backup.timer || true
echo 'Memory (MiB)'
free -m
echo 'Application disk'
df -h /opt/qmah
echo 'Service memory and restart counts'
systemctl show qmah-api qmah-web caddy --property=Id,ActiveState,MemoryCurrent,MemoryPeak,NRestarts
echo 'Backup schedule'
systemctl show qmah-backup.timer --property=LastTriggerUSec,NextElapseUSecRealtime
echo 'HTTP readiness'
for path in '/home' '/api/v1/catalog/artifacts?pageSize=1' '/admin/Account/Login'; do
    curl -sS --max-time 15 --resolve 'qmah.eastus.cloudapp.azure.com:443:127.0.0.1' \
        -o /dev/null -w "$path HTTP %{http_code} time=%{time_total}s\n" \
        "https://qmah.eastus.cloudapp.azure.com$path" || true
done
echo 'Database state, blocking, sessions, relevant indexes and recent backups'
sql="SET NOCOUNT ON;
SELECT name,state_desc,is_read_committed_snapshot_on FROM sys.databases WHERE name=N'QMAH';
SELECT session_id,status,command,blocking_session_id,wait_type,wait_time,total_elapsed_time FROM sys.dm_exec_requests WHERE database_id=DB_ID(N'QMAH') AND session_id<>@@SPID;
SELECT request_status,COUNT(*) AS lock_count FROM sys.dm_tran_locks WHERE resource_database_id=DB_ID(N'QMAH') GROUP BY request_status;
SELECT status,COUNT(*) AS session_count FROM sys.dm_exec_sessions WHERE is_user_process=1 GROUP BY status;
USE [QMAH];
SELECT t.name AS table_name,i.name AS index_name,i.is_unique FROM sys.indexes i JOIN sys.tables t ON t.object_id=i.object_id WHERE t.name IN ('ArtifactUnlocks','PointBalances','KeyBalances','CartItems','GamePlayers') AND i.index_id>0 ORDER BY t.name,i.name;
SELECT TOP (3) database_name,backup_start_date,backup_finish_date,type,backup_size,is_copy_only FROM msdb.dbo.backupset WHERE database_name=N'QMAH' ORDER BY backup_finish_date DESC;"
if ! timeout 30 docker exec qmah-sql sh -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -l 5 -t 10 -Q "$1"' sh "$sql"; then
    echo 'Database diagnostics failed or timed out.'
fi
echo 'QMAH_DIAGNOSTICS_END'
