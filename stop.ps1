param([switch]$Backup)

$ErrorActionPreference = "Stop"

$uiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$uiUrl = if ($env:UI_URL) { $env:UI_URL } else { "http://127.0.0.1:8765" }
$qdrantHealthUrl = if ($env:QDRANT_HEALTH_URL) { $env:QDRANT_HEALTH_URL } else { "http://127.0.0.1:6333/collections/spotify_tracks" }

function Backup-Data {
    $source = Join-Path $uiDir "data"
    $target = Join-Path $source ("backups\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    foreach ($name in @("embeat.db", "embeat.db-wal", "embeat.db-shm", "secret.key", "chinese_singers_extended.json")) {
        $path = Join-Path $source $name
        if (Test-Path -LiteralPath $path -PathType Leaf) { Copy-Item -LiteralPath $path -Destination $target -Force }
    }
    Write-Host "[BACKUP] 已备份到 $target" -ForegroundColor Green
}

if ($Backup) { Backup-Data; exit 0 }

function Get-UiProcess {
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "server\.py" }
}

function Get-QdrantProcess {
    Get-Process -Name "qdrant" -ErrorAction SilentlyContinue
}

function Test-UiOnline {
    try {
        $health = Invoke-RestMethod -Uri "$uiUrl/api/health" -Method Get -TimeoutSec 3
        return $health.ready
    }
    catch {
        return $false
    }
}

function Test-QdrantOnline {
    try {
        $response = Invoke-RestMethod -Uri $qdrantHealthUrl -Method Get -TimeoutSec 3
        return ($response.status -eq "ok" -and $response.result.status -eq "green")
    }
    catch {
        return $false
    }
}

function Stop-Ui {
    $procs = @(Get-UiProcess)
    if ($procs.Count -eq 0) {
        Write-Host "[INFO] Embeat UI 未在运行" -ForegroundColor Yellow
        return
    }
    foreach ($proc in $procs) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "[STOP] 已停止 Embeat UI (PID $($proc.ProcessId))" -ForegroundColor Red
    }
}

function Stop-Qdrant {
    $procs = @(Get-QdrantProcess)
    if ($procs.Count -eq 0) {
        Write-Host "[INFO] Qdrant 未在运行" -ForegroundColor Yellow
        return
    }
    foreach ($proc in $procs) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "[STOP] 已停止 Qdrant (PID $($proc.Id))" -ForegroundColor Red
    }
}

function Start-Ui {
    if (Test-UiOnline) {
        Write-Host "[OK] Embeat UI 已经运行" -ForegroundColor Green
        return
    }
    if (Get-UiProcess) {
        Write-Host "[WAIT] Embeat UI 进程存在但未就绪，正在等待……" -ForegroundColor Yellow
        Start-Sleep -Seconds 6
        if (Test-UiOnline) {
            Write-Host "[OK] Embeat UI 已就绪" -ForegroundColor Green
            return
        }
    }
    Write-Host "[START] 正在启动 Embeat UI……" -ForegroundColor Cyan
    Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $uiDir "start.ps1") -WindowStyle Minimized
    Start-Sleep -Seconds 5
    Write-Host "[START] UI 已在后台启动，请稍候访问 $uiUrl" -ForegroundColor Cyan
}

function Start-All {
    if (Test-QdrantOnline) {
        Write-Host "[OK] Qdrant 已就绪" -ForegroundColor Green
    }
    else {
        Write-Host "[START] 正在启动 Qdrant 与 Embeat UI……" -ForegroundColor Cyan
        Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $uiDir "start-all.ps1") -WindowStyle Minimized
        Write-Host "[START] 已在后台启动，Qdrant 加载约需 1-5 分钟" -ForegroundColor Cyan
        return
    }
    Start-Ui
}

function Show-Status {
    $ui = if (Test-UiOnline) { "在线" } elseif (Get-UiProcess) { "启动中" } else { "离线" }
    $qd = if (Test-QdrantOnline) { "在线" } elseif (Get-QdrantProcess) { "启动中" } else { "离线" }
    Write-Host ""
    Write-Host "  状态：" -ForegroundColor White
    Write-Host "    Qdrant (6333)      $qd"
    Write-Host "    Embeat UI (8765)   $ui"
    if (Test-UiOnline) {
        try {
            $health = Invoke-RestMethod -Uri "$uiUrl/api/health" -Method Get -TimeoutSec 3
            Write-Host "    曲库：$([string]$health.points)" -ForegroundColor DarkGray
        }
        catch { }
    }
}

while ($true) {
    Write-Host ""
    Write-Host "===== Embeat 进程控制台 =====" -ForegroundColor Cyan
    Write-Host "  1. 全部停止（Qdrant + Embeat UI）"
    Write-Host "  2. 仅停止 Embeat UI（保留 Qdrant）"
    Write-Host "  3. 重启 Embeat UI"
    Write-Host "  4. 重启全部（Qdrant + Embeat UI）"
    Write-Host "  5. 查看状态"
    Write-Host "  6. 备份认证数据库与密钥"
    Write-Host "  7. 退出"
    $choice = Read-Host "请选择"
    switch ($choice) {
        "1" { Stop-Ui; Stop-Qdrant }
        "2" { Stop-Ui }
        "3" { Stop-Ui; Start-Sleep -Seconds 1; Start-Ui }
        "4" { Stop-Ui; Stop-Qdrant; Start-All }
        "5" { Show-Status }
        "6" { Backup-Data }
        "7" { Write-Host "再见" -ForegroundColor Cyan; exit }
        default { Write-Host "无效选择，请输入 1-7" -ForegroundColor Red }
    }
}
