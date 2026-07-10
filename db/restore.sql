-- =====================================================================
--  AutoWash Pro — automatic database restore from AutoWashPro.bak
--  Runs from the db-init container via sqlcmd. Idempotent: only restores
--  when the target database does not already exist, so container
--  restarts keep the existing (possibly modified) data.
--
--  Logical file names inside the .bak are discovered at runtime with
--  RESTORE FILELISTONLY, so this works regardless of how the backup was
--  authored (Windows paths, arbitrary logical names, etc.).
-- =====================================================================

SET NOCOUNT ON;

DECLARE @dbName   sysname = N'AutoWashPro';
DECLARE @bakPath  nvarchar(260) = N'/var/opt/mssql/backup/AutoWashPro.bak';
DECLARE @dataDir  nvarchar(260) = N'/var/opt/mssql/data/';

IF DB_ID(@dbName) IS NOT NULL
BEGIN
    PRINT 'Database [' + @dbName + '] already exists — skipping restore.';
    RETURN;
END

-- ---- Read the logical file list from the backup --------------------
IF OBJECT_ID('tempdb..#filelist') IS NOT NULL DROP TABLE #filelist;

CREATE TABLE #filelist (
    LogicalName          nvarchar(128),
    PhysicalName         nvarchar(260),
    Type                 char(1),
    FileGroupName        nvarchar(128) NULL,
    Size                 numeric(20,0),
    MaxSize              numeric(20,0),
    FileID               bigint,
    CreateLSN            numeric(25,0),
    DropLSN              numeric(25,0) NULL,
    UniqueId             uniqueidentifier,
    ReadOnlyLSN          numeric(25,0) NULL,
    ReadWriteLSN         numeric(25,0) NULL,
    BackupSizeInBytes    bigint,
    SourceBlockSize      int,
    FileGroupID          int,
    LogGroupGUID         uniqueidentifier NULL,
    DifferentialBaseLSN  numeric(25,0) NULL,
    DifferentialBaseGUID uniqueidentifier NULL,
    IsReadOnly           bit,
    IsPresent            bit,
    TDEThumbprint        varbinary(32) NULL,
    SnapshotUrl          nvarchar(360) NULL
);

DECLARE @fileListSql nvarchar(max) =
    N'RESTORE FILELISTONLY FROM DISK = ' + QUOTENAME(@bakPath, '''') + N';';

INSERT INTO #filelist EXEC (@fileListSql);

-- ---- Build MOVE clauses for every file in the backup ---------------
DECLARE @moveClauses nvarchar(max) = N'';

SELECT @moveClauses = @moveClauses
    + N'    MOVE ' + QUOTENAME(LogicalName, '''')
    + N' TO ''' + @dataDir + @dbName
        + CASE WHEN Type = 'L' THEN N'_' + CAST(FileID AS nvarchar(10)) + N'.ldf'
               WHEN FileID = 1 THEN N'.mdf'
               ELSE N'_' + CAST(FileID AS nvarchar(10)) + N'.ndf'
          END
    + N''',' + CHAR(13) + CHAR(10)
FROM #filelist;

-- ---- Restore -------------------------------------------------------
DECLARE @restoreSql nvarchar(max) =
    N'RESTORE DATABASE ' + QUOTENAME(@dbName) + CHAR(13) + CHAR(10) +
    N'FROM DISK = ' + QUOTENAME(@bakPath, '''') + CHAR(13) + CHAR(10) +
    N'WITH ' + CHAR(13) + CHAR(10) +
    @moveClauses +
    N'    REPLACE, RECOVERY, STATS = 10;';

PRINT 'Restoring [' + @dbName + '] from ' + @bakPath + ' ...';
PRINT @restoreSql;

EXEC (@restoreSql);

PRINT 'Restore of [' + @dbName + '] complete.';
