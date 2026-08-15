$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

$condaEnv = if ($env:EMBEAT_CONDA_ENV) { $env:EMBEAT_CONDA_ENV } else { "embeat" }

conda run --no-capture-output -n $condaEnv python server.py