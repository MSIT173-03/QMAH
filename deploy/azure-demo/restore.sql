IF DB_ID(N'QMAH') IS NULL
BEGIN
 RESTORE DATABASE [QMAH] FROM DISK=N'/var/opt/mssql/backup/QMAH.bak'
 WITH MOVE N'QMAH' TO N'/var/opt/mssql/data/QMAH.mdf',
      MOVE N'QMAH_log' TO N'/var/opt/mssql/data/QMAH_log.ldf';
END
