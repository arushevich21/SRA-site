[CmdletBinding()]
param(
  [int] $Port = 3100,
  [switch] $Restart
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$appFilter = '@sra/cockpit'
$healthPath = '/stream-mocks/external.html?kind=discord'
$baseUrl = "http://127.0.0.1:$Port"

function Get-Listener([int] $TargetPort) {
  Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

function Get-ProcessCommandLine([int] $ProcessId) {
  (Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue).CommandLine
}

function Test-StreamServer {
  try {
    $response = Invoke-WebRequest -Uri ($baseUrl + $healthPath) -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200 -and $response.Content -match 'Stream integration mock'
  } catch {
    return $false
  }
}

$listener = Get-Listener $Port
if ($listener) {
  $commandLine = Get-ProcessCommandLine $listener.OwningProcess
  $isOurServer = $commandLine -match [regex]::Escape($repoRoot) -and
    ($commandLine -match 'next(\.cmd)?\s+dev' -or $commandLine -match 'next[\\/].*start-server\.js')

  if ($isOurServer -and (Test-StreamServer)) {
    if (-not $Restart) {
      Write-Host "Local stream-resource server is already running: $baseUrl"
      exit 0
    }
    Write-Host "Stopping existing local stream-resource server (PID $($listener.OwningProcess))..."
    Stop-Process -Id $listener.OwningProcess -Force
    Start-Sleep -Milliseconds 500
  } else {
    throw "Port $Port is already in use by PID $($listener.OwningProcess). Refusing to stop an unrelated process. Command: $commandLine"
  }
}

$logPath = Join-Path ([System.IO.Path]::GetTempPath()) 'sra-local-stream-server.log'
Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue

# These values only allow Supabase's server client and middleware to initialize.
# Overlay reads fall back to checked-in demo content when no local Supabase is available.
$oldUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$oldKey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
$oldServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://local-development.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = 'local-development-anon-key'
$env:SUPABASE_SERVICE_ROLE_KEY = 'local-development-service-role-key'

try {
  $arguments = @('/d', '/c', "corepack pnpm --filter $appFilter dev --hostname 127.0.0.1 --port $Port > `"$logPath`" 2>&1")
  Start-Process -FilePath 'cmd.exe' -ArgumentList $arguments -WorkingDirectory $repoRoot -WindowStyle Hidden | Out-Null
} finally {
  $env:NEXT_PUBLIC_SUPABASE_URL = $oldUrl
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $oldKey
  $env:SUPABASE_SERVICE_ROLE_KEY = $oldServiceKey
}

$deadline = (Get-Date).AddSeconds(30)
do {
  Start-Sleep -Milliseconds 500
  if (Test-StreamServer) {
    Write-Host "Local stream-resource server is ready: $baseUrl"
    Write-Host "Mock resource verified: $healthPath"
    Write-Host "Server log: $logPath"
    exit 0
  }
} while ((Get-Date) -lt $deadline)

$log = if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Raw } else { '(no server log was created)' }
throw "Local stream-resource server did not become ready at $baseUrl within 30 seconds.`n$log"
