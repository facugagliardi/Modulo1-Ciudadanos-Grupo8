param([string[]]$MavenArguments = @('verify'))
$ErrorActionPreference = 'Stop'
$variables = @('M1_TEST_POSTGRES_URL', 'M1_TEST_POSTGRES_USER', 'M1_TEST_POSTGRES_PASSWORD', 'JAVA_HOME')
$anteriores = @{}
foreach ($variable in $variables) { $anteriores[$variable] = [Environment]::GetEnvironmentVariable($variable, 'Process') }
$repo = Join-Path $PSScriptRoot '..'
$nombre = 'ciudadanos-sca-db-' + [guid]::NewGuid().ToString('N').Substring(0, 10)
$claveTemporal = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
New-Item -ItemType Directory -Force (Join-Path $repo 'target') | Out-Null
Push-Location $repo
try {
    docker run -d --name $nombre --label ciudadanos.sca.temporal=true -e "POSTGRES_PASSWORD=$claveTemporal" -p 127.0.0.1::5432 --health-cmd 'pg_isready -U postgres -h 127.0.0.1' --health-interval 2s --health-retries 30 ciudadanos-testing-postgres *> (Join-Path $repo 'target/postgres-test.log')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL de prueba' }
    $sano = $false
    for ($i = 0; $i -lt 60; $i++) {
        if ((docker inspect --format '{{.State.Health.Status}}' $nombre) -eq 'healthy') { $sano = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $sano) { throw 'PostgreSQL de prueba no llego a healthy' }
    $direccion = docker port $nombre 5432/tcp
    $puertoPrueba = ($direccion -split ':')[-1]
    $env:M1_TEST_POSTGRES_URL = "jdbc:postgresql://127.0.0.1:$puertoPrueba/postgres"
    $env:M1_TEST_POSTGRES_USER = 'postgres'
    $env:M1_TEST_POSTGRES_PASSWORD = $claveTemporal
    if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Java\jdk-21.0.10' }
    & ./mvnw.cmd -B -ntp @MavenArguments *> (Join-Path $repo 'target/maven-testing.log')
    if ($LASTEXITCODE -ne 0) { throw 'Fallo Maven; revisar target/maven-testing.log' }
    if ($MavenArguments -notcontains 'verify') { return }
    $reportes = Get-ChildItem target/surefire-reports/TEST-*.xml
    if (-not $reportes) { throw 'Faltan reportes Surefire' }
    $total = 0; $fallos = 0; $errores = 0; $omitidos = 0
    foreach ($archivo in $reportes) {
        [xml]$xml = Get-Content -LiteralPath $archivo.FullName -Raw
        $total += [int]$xml.testsuite.tests
        $fallos += [int]$xml.testsuite.failures
        $errores += [int]$xml.testsuite.errors
        $omitidos += [int]$xml.testsuite.skipped
    }
    [pscustomobject]@{tests=$total;fallos=$fallos;errores=$errores;omitidos=$omitidos} | ConvertTo-Json -Compress
    if ($total -eq 0 -or $fallos -or $errores -or $omitidos) { throw 'Resultado Java incompleto o con errores' }
} finally {
    $etiqueta = docker inspect --format '{{index .Config.Labels "ciudadanos.sca.temporal"}}' $nombre 2>$null
    if ($etiqueta -eq 'true') { docker rm -f $nombre | Out-Null }
    foreach ($variable in $variables) { [Environment]::SetEnvironmentVariable($variable, $anteriores[$variable], 'Process') }
    Pop-Location
}

