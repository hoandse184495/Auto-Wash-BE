#!/usr/bin/env bash
# =====================================================================
#  AutoWash Pro — db-init entrypoint
#  Waits until the SQL Server instance accepts logins, then runs the
#  idempotent restore script. Exits 0 on success so compose treats the
#  init step as "completed".
# =====================================================================
set -euo pipefail

SA_PASSWORD="${MSSQL_SA_PASSWORD:?MSSQL_SA_PASSWORD is required}"

# sqlcmd location differs across mssql-tools image versions.
if [ -x /opt/mssql-tools18/bin/sqlcmd ]; then
  SQLCMD=/opt/mssql-tools18/bin/sqlcmd
  # tools18 defaults to encryption; trust the self-signed dev cert.
  TLS_FLAGS="-C"
else
  SQLCMD=/opt/mssql-tools/bin/sqlcmd
  TLS_FLAGS=""
fi

echo "⏳ Waiting for SQL Server (host: db) to be ready..."
for i in $(seq 1 60); do
  if "$SQLCMD" -S db -U sa -P "$SA_PASSWORD" $TLS_FLAGS -l 3 -Q "SELECT 1" >/dev/null 2>&1; then
    echo "✅ SQL Server is accepting connections (after ${i} attempt(s))."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "❌ SQL Server did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done

echo "📦 Running restore script..."
"$SQLCMD" -S db -U sa -P "$SA_PASSWORD" $TLS_FLAGS -b -i /scripts/restore.sql

echo "🎉 Database initialization finished."
