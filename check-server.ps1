# PowerShell script to check server status and logs

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CareONE Journey API - Server Status Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js installation
Write-Host "1. Checking Node.js installation..." -ForegroundColor Yellow
$nodePath = "C:\Program Files\nodejs\node.exe"
if (Test-Path $nodePath) {
    $nodeVersion = & $nodePath --version
    Write-Host "   ✓ Node.js found: $nodeVersion" -ForegroundColor Green
    Write-Host "   Path: $nodePath" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Node.js not found at: $nodePath" -ForegroundColor Red
    Write-Host "   Please update web.config with correct Node.js path" -ForegroundColor Yellow
}
Write-Host ""

# Check application files
Write-Host "2. Checking application files..." -ForegroundColor Yellow
$appJs = Test-Path "app.js"
$webConfig = Test-Path "web.config"
$packageJson = Test-Path "package.json"
$nodeModules = Test-Path "node_modules"

if ($appJs) { Write-Host "   ✓ app.js found" -ForegroundColor Green } else { Write-Host "   ✗ app.js missing" -ForegroundColor Red }
if ($webConfig) { Write-Host "   ✓ web.config found" -ForegroundColor Green } else { Write-Host "   ✗ web.config missing" -ForegroundColor Red }
if ($packageJson) { Write-Host "   ✓ package.json found" -ForegroundColor Green } else { Write-Host "   ✗ package.json missing" -ForegroundColor Red }
if ($nodeModules) { Write-Host "   ✓ node_modules found" -ForegroundColor Green } else { Write-Host "   ✗ node_modules missing - Run 'npm install'" -ForegroundColor Red }
Write-Host ""

# Check logs directory
Write-Host "3. Checking logs directory..." -ForegroundColor Yellow
$logsDir = "logs"
if (Test-Path $logsDir) {
    Write-Host "   ✓ logs directory exists" -ForegroundColor Green
    
    # Check log files
    $logFiles = Get-ChildItem -Path $logsDir -Filter "*.log" | Sort-Object LastWriteTime -Descending
    if ($logFiles.Count -gt 0) {
        Write-Host "   Found $($logFiles.Count) log file(s):" -ForegroundColor Gray
        foreach ($log in $logFiles) {
            $size = [math]::Round($log.Length / 1KB, 2)
            Write-Host "   - $($log.Name) ($size KB, Modified: $($log.LastWriteTime))" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠ No log files found (server may not have started)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✗ logs directory missing - Creating it..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    Write-Host "   ✓ logs directory created" -ForegroundColor Green
}
Write-Host ""

# Display latest log content
Write-Host "4. Latest log entries (last 30 lines):" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
$latestLog = Get-ChildItem -Path $logsDir -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestLog) {
    $logContent = Get-Content -Path $latestLog.FullName -Tail 30 -ErrorAction SilentlyContinue
    if ($logContent) {
        $logContent | ForEach-Object {
            if ($_ -match "error|Error|ERROR|failed|Failed|FAILED") {
                Write-Host $_ -ForegroundColor Red
            } elseif ($_ -match "success|Success|SUCCESS|running|Running|started|Started") {
                Write-Host $_ -ForegroundColor Green
            } else {
                Write-Host $_ -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "   Log file is empty" -ForegroundColor Yellow
    }
} else {
    Write-Host "   No log files found" -ForegroundColor Yellow
}
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

# Check environment variables
Write-Host "5. Environment information:" -ForegroundColor Yellow
Write-Host "   Current Directory: $(Get-Location)" -ForegroundColor Gray
Write-Host "   Node Environment: $($env:NODE_ENV)" -ForegroundColor Gray
Write-Host "   Port: $($env:PORT)" -ForegroundColor Gray
Write-Host ""

# Test endpoints (if server is running)
Write-Host "6. Testing endpoints (if server is running):" -ForegroundColor Yellow
$baseUrl = "https://careone-health.com/careone-journey-api"
try {
    $healthResponse = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✓ Health endpoint responding: $($healthResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($healthResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Health endpoint not responding: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Check complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check the log file above for errors" -ForegroundColor White
Write-Host "2. Verify Node.js path in web.config" -ForegroundColor White
Write-Host "3. Check IIS Application Pool status" -ForegroundColor White
Write-Host "4. Ensure IIS application pool has proper permissions" -ForegroundColor White
Write-Host "5. Test the application locally: node app.js" -ForegroundColor White

