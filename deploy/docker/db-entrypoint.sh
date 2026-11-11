#!/bin/bash
# Start SQL Server and restore only a missing demonstration database.
set -euo pipefail
export PATH="/opt/mssql-tools18/bin:/opt/mssql/bin:$PATH"
: "${MSSQL_SA_PASSWORD:?MSSQL_SA_PASSWORD is required}"

run_sql() {
    # Keep passwords, including spaces, out of command-line arguments.
    SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" sqlcmd -S localhost -U sa -C -b "$@"
}

sqlservr &
server_pid=$!
cleanup() {
    kill -TERM "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

ready=false
for ((attempt=0; attempt<60; attempt++)); do
    if ! kill -0 "$server_pid" 2>/dev/null; then
        echo 'SQL Server exited before becoming ready.' >&2
        exit 1
    fi
    if run_sql -Q 'SELECT 1' >/dev/null 2>&1; then ready=true; break; fi
    sleep 2
done
if [ "$ready" != true ]; then
    echo 'SQL Server did not become ready; restore was not attempted.' >&2
    exit 1
fi

run_sql -Q "IF DB_ID(N'QMAH') IS NULL RESTORE DATABASE [QMAH] FROM DISK=N'/backup/QMAH.bak' WITH MOVE N'QMAH' TO N'/var/opt/mssql/data/QMAH.mdf', MOVE N'QMAH_log' TO N'/var/opt/mssql/data/QMAH_log.ldf'"
wait "$server_pid"
