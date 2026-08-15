$ErrorActionPreference = "Stop"

$uiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$qdrantDir = $env:QDRANT_DIR
$qdrantExe = if ($qdrantDir) { Join-Path $qdrantDir "qdrant.exe" } else { "" }
$qdrantStorage = if ($qdrantDir) { Join-Path $qdrantDir "embeat_qdrant_db" } else { "" }
$qdrantHealthUrl = if ($env:QDRANT_HEALTH_URL) { $env:QDRANT_HEALTH_URL } else { "http://127.0.0.1:6333/collections/spotify_tracks" }
$uiUrl = if ($env:UI_URL) { $env:UI_URL } else { "http://127.0.0.1:8765" }

function Test-QdrantReady {
    try {
        $response = Invoke-RestMethod -Uri $qdrantHealthUrl -Method Get -TimeoutSec 3
        return ($response.status -eq "ok" -and $response.result.status -eq "green")
    }
    catch {
        return $false
    }
}

function Find-QdrantProcess {
    $expectedPath = if ($qdrantExe) { [System.IO.Path]::GetFullPath($qdrantExe) } else { $null }
    return Get-Process -Name "qdrant" -ErrorAction SilentlyContinue | Where-Object {
        if (-not $expectedPath) { $true }
        else {
            try {
                [System.IO.Path]::GetFullPath($_.Path) -eq $expectedPath
            }
            catch {
                $true
            }
        }
    } | Select-Object -First 1
}

$qdrantReady = Test-QdrantReady
$qdrantProcess = Find-QdrantProcess

if (-not $qdrantReady -and -not $qdrantProcess) {
    if (-not $qdrantDir -or -not (Test-Path -LiteralPath $qdrantExe -PathType Leaf)) {
        throw "Qdrant 未在运行且未找到本地 qdrant.exe。请在环境中设置 QDRANT_DIR（指向含 qdrant.exe 的目录）或提前启动远程 Qdrant（可用 QDRANT_HEALTH_URL 指定健康检查地址）。"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $qdrantStorage "collections\spotify_tracks") -PathType Container)) {
        throw "找不到 Embeat Qdrant 数据库：$qdrantStorage\collections\spotify_tracks"
    }
}

if ($qdrantReady) {
    Write-Host "[OK] Qdrant 已经运行且 spotify_tracks 状态正常。" -ForegroundColor Green
}
elseif ($qdrantProcess) {
    Write-Host "[WAIT] Qdrant 进程已启动，正在等待数据库加载完成……" -ForegroundColor Yellow
}
else {
    Write-Host "[START] 正在启动 Qdrant……" -ForegroundColor Cyan
    $oldStoragePath = $env:QDRANT__STORAGE__STORAGE_PATH
    try {
        $env:QDRANT__STORAGE__STORAGE_PATH = $qdrantStorage
        Start-Process `
            -FilePath $qdrantExe `
            -WorkingDirectory $qdrantDir `
            -WindowStyle Hidden
    }
    finally {
        if ($null -eq $oldStoragePath) {
            Remove-Item Env:QDRANT__STORAGE__STORAGE_PATH -ErrorAction SilentlyContinue
        }
        else {
            $env:QDRANT__STORAGE__STORAGE_PATH = $oldStoragePath
        }
    }
}

if (-not $qdrantReady) {
    $timeoutSeconds = 300
    $elapsedSeconds = 0
    while ($elapsedSeconds -lt $timeoutSeconds) {
        Start-Sleep -Seconds 5
        $elapsedSeconds += 5

        if (Test-QdrantReady) {
            $qdrantReady = $true
            break
        }

        $process = Find-QdrantProcess
        if (-not $process -and $qdrantDir) {
            throw "Qdrant 进程在数据库加载完成前退出。"
        }

        Write-Host "[WAIT] Qdrant 正在加载 spotify_tracks…… $elapsedSeconds / $timeoutSeconds 秒" -ForegroundColor DarkYellow
    }
}

if (-not $qdrantReady) {
    throw "等待 Qdrant 超时。请检查 QDRANT_HEALTH_URL 是否正确及 Qdrant 日志。"
}

Write-Host "[OK] Qdrant 数据库已经就绪。" -ForegroundColor Green

try {
    $uiHealth = Invoke-RestMethod -Uri "$uiUrl/api/health" -Method Get -TimeoutSec 3
    if ($uiHealth.ready) {
        Write-Host "[OK] Embeat UI 已经运行：$uiUrl" -ForegroundColor Green
        exit 0
    }
}
catch {
    # UI 尚未运行，继续启动。
}

Write-Host "[START] 正在启动 Embeat UI……" -ForegroundColor Cyan
Write-Host "浏览器地址：$uiUrl" -ForegroundColor White
Write-Host "按 Ctrl+C 可停止 UI；Qdrant 将继续在后台运行。" -ForegroundColor DarkGray

Set-Location $uiDir
& (Join-Path $uiDir "start.ps1")