$ErrorActionPreference = 'Stop'

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Error "pg_dump not found on PATH. Install PostgreSQL 17.x client tools (or add them to PATH) before running this script - see CLAUDE.md's schema-dump connection notes."
    exit 1
}

$match = Select-String -Path apps/cockpit/.env.local -Pattern '^SUPABASE_DB_PASSWORD=(.+)$'
if (-not $match) {
    Write-Error "SUPABASE_DB_PASSWORD not found in apps/cockpit/.env.local"
    exit 1
}
$env:PGPASSWORD = $match.Matches[0].Groups[1].Value

pg_dump --schema-only --no-owner --no-privileges --schema=public -h aws-1-us-west-2.pooler.supabase.com -p 5432 -U postgres.nwjfnfostaomraofbxfj -d postgres -f supabase/schema.sql

# pg_dump is a native exe: a connection/auth failure exits non-zero, but
# PowerShell does not treat that as a terminating error on its own - that is
# what produced the false "schema.sql updated" before: the write-host below
# ran unconditionally regardless of whether the dump actually succeeded.
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed with exit code $LASTEXITCODE - supabase/schema.sql was NOT updated (or is stale/truncated). Do not trust its contents."
    exit $LASTEXITCODE
}

Write-Host "schema.sql updated"
