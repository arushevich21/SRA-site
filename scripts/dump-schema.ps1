$pw = (Select-String -Path apps/cockpit/.env.local -Pattern '^SUPABASE_DB_PASSWORD=(.+)$').Matches[0].Groups[1].Value
$env:PGPASSWORD = $pw
pg_dump --schema-only --no-owner --no-privileges --schema=public -h aws-1-us-west-2.pooler.supabase.com -p 5432 -U postgres.nwjfnfostaomraofbxfj -d postgres -f supabase/schema.sql
Write-Host "schema.sql updated"