# start-all.ps1 - Lance toute la pile "SI Education" (Fuseki + API + 2 frontends).
#
# Les serveurs sont demarres comme processus detaches : ils survivent a la
# fermeture du terminal et a la fin de la session qui les a lances.
# Les journaux sont ecrits dans .logs/ a la racine du projet.
#
#   .\start-all.ps1
#
# Ports :
#   3001  landing React/Vite   (3000 est occupe par un autre conteneur Docker)
#   5173  back-office React/Vite
#   8000  API FastAPI (Swagger : /docs)
#   3030  Apache Jena Fuseki

$ErrorActionPreference = 'Stop'
$racine = Split-Path -Parent $MyInvocation.MyCommand.Path
$logs   = Join-Path $racine '.logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Test-PortOpen([int]$port) {
    foreach ($addr in '127.0.0.1', '::1') {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient($addr, $port)
            $tcp.Close()
            return $true
        } catch {
            # try next address
        }
    }
    return $false
}

function Start-DetachedProcess([string]$exe, [string]$argsStr, [string]$workingDir, [string]$logOut, [string]$logErr) {
    $si = ([wmiclass]"Win32_ProcessStartup").CreateInstance()
    $si.ShowWindow = 0
    $proc = [wmiclass]"Win32_Process"
    $cmdLine = "cmd.exe /s /c `"`"$exe`" $argsStr > `"$logOut`" 2> `"$logErr`"`""
    $res = $proc.Create($cmdLine, $workingDir, $si)
    if ($res.ReturnValue -ne 0) {
        Write-Warning "Echec de demarrage: $cmdLine (code $($res.ReturnValue))"
    }
    return $res.ProcessId
}

# ------------------------------------------------------- Fuseki (Docker) ---
$conteneur = docker ps --filter 'name=fuseki-education' --format '{{.Names}}'
if ($conteneur -match 'fuseki-education') {
    Write-Host '[OK]    Fuseki deja demarre (conteneur fuseki-education).'
} else {
    Write-Host '[START] Fuseki (docker compose up -d)...'
    docker compose -f (Join-Path $racine 'docker-compose.yml') up -d
}

$node   = (Get-Command node -ErrorAction Stop).Source
$python = Join-Path $racine 'backend\.venv\Scripts\python.exe'

# ------------------------------------------------- API FastAPI (port 8000) --
if (-not (Test-PortOpen 8000)) {
    Write-Host '[START] API FastAPI sur http://localhost:8000 ...'
    Start-DetachedProcess `
        $python `
        '-m uvicorn app.main:app --host 0.0.0.0 --port 8000' `
        (Join-Path $racine 'backend') `
        (Join-Path $logs 'api.log') `
        (Join-Path $logs 'api.err.log') | Out-Null
} else {
    Write-Host '[OK]    API FastAPI deja active sur port 8000.'
}

# -------------------------------------------- Landing React/Vite (port 3001) --
if (-not (Test-PortOpen 3001)) {
    Write-Host '[START] Landing React + Vite sur http://localhost:3001 ...'
    $viteLanding = Join-Path $racine 'node_modules\vite\bin\vite.js'
    Start-DetachedProcess `
        $node `
        "`"$viteLanding`"" `
        $racine `
        (Join-Path $logs 'frontend.log') `
        (Join-Path $logs 'frontend.err.log') | Out-Null
} else {
    Write-Host '[OK]    Landing React deja active sur port 3001.'
}

# ------------------------------------- Back-office Vite (port 5173) --------
if (-not (Test-PortOpen 5173)) {
    Write-Host '[START] Back-office Vite sur http://localhost:5173 ...'
    $viteDashboard = Join-Path $racine 'dashboard\node_modules\vite\bin\vite.js'
    Start-DetachedProcess `
        $node `
        "`"$viteDashboard`" --host --port 5173 --strictPort" `
        (Join-Path $racine 'dashboard') `
        (Join-Path $logs 'dashboard.log') `
        (Join-Path $logs 'dashboard.err.log') | Out-Null
} else {
    Write-Host '[OK]    Back-office deja active sur port 5173.'
}

# ------------------------------------------------------------- Verifications
Write-Host ''
Write-Host 'Attente du demarrage (max 90 s)...'
for ($i = 0; $i -lt 90; $i++) {
    $allReady = $true
    foreach ($p in 8000, 3001, 5173) {
        if (-not (Test-PortOpen $p)) {
            $allReady = $false
            break
        }
    }
    if ($allReady) { break }
    Start-Sleep -Seconds 1
}

foreach ($p in 3030, 8000, 3001, 5173) {
    if (Test-PortOpen $p) {
        Write-Host ("[OK]    port {0} en ecoute" -f $p)
    } else {
        Write-Host ("[ECHEC] port {0} non ecoute - voir .logs\" -f $p)
    }
}

Write-Host ''
Write-Host '  Landing      : http://localhost:3001'
Write-Host '  Back-office  : http://localhost:5173/education'
Write-Host '  API (Swagger): http://localhost:8000/docs'
Write-Host '  Fuseki       : http://localhost:3030'
Write-Host ''
Write-Host "Journaux : $logs"
