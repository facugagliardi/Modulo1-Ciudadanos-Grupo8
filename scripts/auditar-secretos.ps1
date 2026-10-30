param(
    [string]$Gitleaks = 'gitleaks',
    [string]$ReportDir = (Join-Path ([IO.Path]::GetTempPath()) ('ciudadanos-secret-audit-' + [guid]::NewGuid().ToString('N')))
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$scanner = (Get-Command $Gitleaks -ErrorAction Stop).Source
$ReportDir = [IO.Path]::GetFullPath($ReportDir)
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
# Solo archivos que Git permitiria versionar: excluye application-local.yml, .env,
# target y node_modules. Incluye cambios pendientes y archivos nuevos no ignorados.
$snapshot = Join-Path $ReportDir ('snapshot-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $snapshot | Out-Null
Push-Location $repo
try {
    $files = & git -c core.quotepath=false ls-files --cached --others --exclude-standard
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo listar el contenido del repositorio.' }
    foreach ($relative in $files) {
        $source = Join-Path $repo $relative
        if (Test-Path -LiteralPath $source -PathType Leaf) {
            # Gitleaks dir trata .bru como binario por su extension: escanear su texto.
            $scanRelative = if ($relative.EndsWith('.bru')) { $relative + '.txt' } else { $relative }
            $destination = Join-Path $snapshot $scanRelative
            New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
            Copy-Item -LiteralPath $source -Destination $destination
        }
    }
    $config = Join-Path $repo '.gitleaks.toml'
    $failed = $false
    foreach ($mode in @('files', 'history')) {
        $report = Join-Path $ReportDir "$mode.json"
        $log = Join-Path $ReportDir "$mode.log"
        $arguments = if ($mode -eq 'files') { @('dir', $snapshot) } else { @('git', $repo, '--log-opts=--all --full-history --no-textconv') }
        & $scanner @arguments --config $config --redact --no-banner --no-color --report-format json --report-path $report *> $log
        $scanExit = $LASTEXITCODE
        # No confundir un fallo interno con un resultado limpio, incluso si sale con 0.
        if ($scanExit -notin @(0, 1) -or (Select-String -LiteralPath $log -Pattern '\b(ERR|FTL)\b' -Quiet)) {
            throw "Escaneo $mode incompleto. Revisar $log (valores redactados)."
        }
        $findings = @(Get-Content -LiteralPath $report -Raw | ConvertFrom-Json)
        Write-Host "$mode : $($findings.Count) hallazgos. Reporte: $report"
        if ($scanExit -eq 1 -or $findings.Count -gt 0) { $failed = $true }
    }
    if ($failed) { exit 1 }
} finally {
    Pop-Location
    $resolvedSnapshot = [IO.Path]::GetFullPath($snapshot)
    if (-not $resolvedSnapshot.StartsWith($ReportDir.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'El snapshot no pertenece al directorio de auditoria.'
    }
    Remove-Item -LiteralPath $resolvedSnapshot -Recurse -Force
}
