param(
    [string]$Python = "",
    [int]$ApiPort = 8765,
    [int]$WebPort = 5174
)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
if ($ApiPort -ne 8765) { throw 'The frontend proxy currently requires ApiPort 8765.' }
if (-not $Python) { $Python = Join-Path $Root '.venv\Scripts\python.exe' }
if (-not (Test-Path $Python)) { throw 'Python environment missing. See STUDIO.md for setup.' }
if (-not (Test-Path (Join-Path $Root 'frontend\node_modules'))) { throw 'Frontend dependencies missing. Run npm ci in frontend first.' }
foreach ($port in @($ApiPort, $WebPort)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($listener) { throw "Port $port is already in use. Existing services were not stopped." }
}
$api = $null
$web = $null
try {
    $api = Start-Process -FilePath $Python -ArgumentList @('-m', 'uvicorn', 'backend.app:app', '--host', '127.0.0.1', '--port', "$ApiPort") -WorkingDirectory $Root -PassThru -NoNewWindow
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        if ($api.HasExited) { throw 'API exited before readiness. Inspect the error above.' }
        try { $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$ApiPort/api/health" -TimeoutSec 1; $ready = $response.StatusCode -eq 200 } catch { }
        if ($ready) { break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'API health check timed out.' }
    Write-Host "Studio: http://127.0.0.1:$WebPort"
    Write-Host 'Press Ctrl+C to stop this session.'
    $web = Start-Process -FilePath $env:ComSpec -ArgumentList @('/c', 'npm.cmd', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', "$WebPort", '--strictPort') -WorkingDirectory (Join-Path $Root 'frontend') -PassThru -NoNewWindow
    Wait-Process -Id $web.Id
} finally {
    foreach ($process in @($web, $api)) {
        if ($process -and -not $process.HasExited) {
            try {
                # Only target processes launched by this session, including their children.
                & "$env:SystemRoot\System32\taskkill.exe" /PID $process.Id /T /F 2>$null | Out-Null
                if ($LASTEXITCODE -ne 0 -and -not $process.HasExited) {
                    Write-Warning "Could not stop launched process tree $($process.Id)."
                }
            } catch {
                if (-not $process.HasExited) { Write-Warning "Could not stop launched process tree $($process.Id): $_" }
            }
        }
    }
}
