# start-all.ps1 - Lance toute la pile "SI Education" (Fuseki + API + 2 frontends).
#
# Les serveurs sont demarres comme processus detaches : ils survivent a la
# fermeture du terminal et a la fin de la session qui les a lances.
# Les journaux sont ecrits dans .logs/ a la racine du projet.
#
#   .\start-all.ps1
#
# Ports :
#   3010  landing Next.js      (3000 est occupe par un autre conteneur Docker)
#   5173  back-office React/Vite
#   8000  API FastAPI (Swagger : /docs)
#   3030  Apache Jena Fuseki

$ErrorActionPreference = 'Stop'
$racine = Split-Path -Parent $MyInvocation.MyCommand.Path
$logs   = Join-Path $racine '.logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

# ------------------------------------------------------- Fuseki (Docker) ---
$conteneur = docker ps --filter 'name=fuseki-education' --format '{{.Names}}'
if ($conteneur -match 'fuseki-education') {
    Write-Host '[OK]    Fuseki deja demarre (conteneur fuseki-education).'
} else {
    Write-Host '[START] Fuseki (docker compose up -d)...'
    docker compose -f (Join-Path $racine 'docker-compose.yml') up -d
}

$node = (Get-Command node -ErrorAction Stop).Source

# ------------------------------------------------- API FastAPI (port 8000) --
Write-Host '[START] API FastAPI sur http://localhost:8000 ...'
Start-Process -FilePath (Join-Path $racine 'backend\.venv\Scripts\python.exe') `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000' `
    -WorkingDirectory (Join-Path $racine 'backend') `
    -RedirectStandardOutput (Join-Path $logs 'api.log') `
    -RedirectStandardError  (Join-Path $logs 'api.err.log') `
    -WindowStyle Hidden | Out-Null

# -------------------------------------------- Landing React/Vite (port 3010) --
Write-Host '[START] Landing React + Vite sur http://localhost:3010 ...'
Start-Process -FilePath $node `
    -ArgumentList (Join-Path $racine 'node_modules\vite\bin\vite.js') `
    -WorkingDirectory $racine `
    -RedirectStandardOutput (Join-Path $logs 'frontend.log') `
    -RedirectStandardError  (Join-Path $logs 'frontend.err.log') `
    -WindowStyle Hidden | Out-Null

# ------------------------------------- Back-office Vite (port 5173) --------
Write-Host '[START] Back-office Vite sur http://localhost:5173 ...'
Start-Process -FilePath $node `
    -ArgumentList (Join-Path $racine 'dashboard\node_modules\vite\bin\vite.js'), '--port', '5173', '--strictPort' `
    -WorkingDirectory (Join-Path $racine 'dashboard') `
    -RedirectStandardOutput (Join-Path $logs 'dashboard.log') `
    -RedirectStandardError  (Join-Path $logs 'dashboard.err.log') `
    -WindowStyle Hidden | Out-Null

# ------------------------------------------------------------- Verifications
Write-Host ''
Write-Host 'Attente du demarrage (max 90 s)...'
$ports = 8000, 3010, 5173
for ($i = 0; $i -lt 90; $i++) {
    $prets = $ports | Where-Object {
        Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue
    }
    if ($prets.Count -eq $ports.Count) { break }
    Start-Sleep -Seconds 1
}

foreach ($p in 3030, 8000, 3010, 5173) {
    $actif = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($actif) {
        Write-Host ("[OK]    port {0} en ecoute (pid {1})" -f $p, $actif[0].OwningProcess)
    } else {
        Write-Host ("[ECHEC] port {0} non ecoute - voir .logs\" -f $p)
    }
}

Write-Host ''
Write-Host '  Landing      : http://localhost:3010'
Write-Host '  Back-office : http://localhost:5173/education'
Write-Host '  API (Swagger): http://localhost:8000/docs'
Write-Host '  Fuseki       : http://localhost:3030'
Write-Host ''
Write-Host "Journaux : $logs"
