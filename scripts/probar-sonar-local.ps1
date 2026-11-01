param([string]$ServerUrl='http://127.0.0.1:29000',[string]$StatePath,[switch]$Consultar,[switch]$RevisarCsrf)
$ErrorActionPreference='Stop'
$repo=Join-Path $PSScriptRoot '..'
$url=$ServerUrl.TrimEnd('/')
if (([uri]$url).Host -notin @('127.0.0.1','localhost')) { throw 'Este helper solo administra SonarQube local' }
if (-not $StatePath) { $StatePath=Join-Path $repo 'target/sonar-auth/admin.clixml' }
New-Item -ItemType Directory -Force (Split-Path $statePath) | Out-Null
$key='ciudadanos-testing-local'
if (-not (Test-Path $statePath)) {
    $status=Invoke-RestMethod "$url/api/system/status" -TimeoutSec 10
    if ($status.status -ne 'UP') { throw "Sonar no esta UP: $($status.status)" }
    $password='M1qa-'+[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))+'!a'
    $headers=@{Authorization='Basic '+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('admin:admin'))}
    Invoke-RestMethod "$url/api/users/change_password" -Method Post -Headers $headers -Body @{login='admin';previousPassword='admin';password=$password} | Out-Null
    [pscredential]::new('admin',(ConvertTo-SecureString $password -AsPlainText -Force)) | Export-Clixml $statePath
}
$credential=Import-Clixml $statePath
$headers=@{Authorization='Basic '+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('admin:'+$credential.GetNetworkCredential().Password))}
$output=Join-Path $repo 'target/sonar-local-evidencia'
New-Item -ItemType Directory -Force $output | Out-Null
if ($RevisarCsrf) {
    $report=Join-Path $repo 'target/surefire-reports/TEST-ar.edu.uade.ciudadanos.security.SeguridadHttpTest.xml'
    [xml]$tests=Get-Content $report -Raw
    if ([int]$tests.testsuite.tests -ne 2 -or [int]$tests.testsuite.failures -or [int]$tests.testsuite.errors -or [int]$tests.testsuite.skipped) {
        throw 'La revision CSRF requiere las dos pruebas HTTP aprobadas sin omisiones'
    }
    foreach ($file in @('src/main/java/ar/edu/uade/ciudadanos/config/SecurityConfig.java','src/main/java/ar/edu/uade/ciudadanos/security/JwtAuthenticationFilter.java','src/test/java/ar/edu/uade/ciudadanos/security/SeguridadHttpTest.java')) {
        if ((Get-Item (Join-Path $repo $file)).LastWriteTimeUtc -gt (Get-Item $report).LastWriteTimeUtc) { throw 'Reejecutar SeguridadHttpTest despues de los cambios' }
    }
    $issues=Invoke-RestMethod "$url/api/issues/search?componentKeys=$key&rules=java:S4502&resolved=false" -Headers $headers
    foreach ($issue in $issues.issues) {
        if ($issue.component -ne "${key}:src/main/java/ar/edu/uade/ciudadanos/config/SecurityConfig.java") { throw 'Hallazgo CSRF fuera del alcance revisado' }
        $comment='Revision tecnica documentada en REVISION_SONAR_JAVA.md: autenticacion exclusivamente Authorization Bearer; cookies y Basic no autentican, no se crea sesion. SeguridadHttpTest aprobado. No aplica CSRF por credenciales ambientales. Reabrir si se agrega autenticacion por cookie, formulario o Basic. No equivale a auditoria CSRF general.'
        Invoke-RestMethod "$url/api/issues/add_comment" -Method Post -Headers $headers -Body @{issue=$issue.key;text=$comment} | Out-Null
        Invoke-RestMethod "$url/api/issues/do_transition" -Method Post -Headers $headers -Body @{issue=$issue.key;transition='falsepositive'} | Out-Null
    }
    Write-Output 'Revision CSRF especifica registrada; ninguna regla fue desactivada'
    return
}
if ($Consultar) {
    foreach($item in @(
        @('estado','api/system/status'),
        @('gate',"api/qualitygates/project_status?projectKey=$key"),
        @('metricas',"api/measures/component?component=$key&metricKeys=coverage,line_coverage,branch_coverage,bugs,vulnerabilities,code_smells,security_hotspots,duplicated_lines_density,ncloc"),
        @('issues',"api/issues/search?componentKeys=$key&ps=500&resolved=false"),
        @('revision-csrf',"api/issues/search?componentKeys=$key&rules=java:S4502&additionalFields=comments"),
        @('configuracion-gate',"api/qualitygates/show?name=$([uri]::EscapeDataString('TP Ciudadanos - codigo completo'))"),
        @('politica-cambios-pequenos',"api/settings/values?component=$key&keys=sonar.qualitygate.ignoreSmallChanges"),
        @('hotspots',"api/hotspots/search?project=$key&ps=500")
    )) {
        $r=Invoke-RestMethod "$url/$($item[1])" -Headers $headers -TimeoutSec 30
        $r | ConvertTo-Json -Depth 40 | Set-Content (Join-Path $output ($item[0]+'.json'))
        if($item[0] -eq 'gate') { $r.projectStatus.status }
    }
    return
}
$existing=Invoke-RestMethod "$url/api/projects/search?projects=$key" -Headers $headers
if ($existing.components.Count -eq 0) {
    Invoke-RestMethod "$url/api/projects/create" -Method Post -Headers $headers -Body @{project=$key;name='Ciudadanos Testing Local';visibility='private'} | Out-Null
}
$gateName='TP Ciudadanos - codigo completo'
$gates=Invoke-RestMethod "$url/api/qualitygates/list" -Headers $headers
if ($gateName -notin $gates.qualitygates.name) {
    Invoke-RestMethod "$url/api/qualitygates/copy" -Method Post -Headers $headers -Body @{sourceName='Sonar way';name=$gateName} | Out-Null
}
$gate=Invoke-RestMethod "$url/api/qualitygates/show?name=$([uri]::EscapeDataString($gateName))" -Headers $headers
foreach ($condition in @(@('bugs','0'),@('vulnerabilities','0'),@('blocker_violations','0'),@('critical_violations','0'),@('duplicated_lines_density','3'))) {
    $current=$gate.conditions | Where-Object metric -EQ $condition[0]
    if (-not $current) {
        Invoke-RestMethod "$url/api/qualitygates/create_condition" -Method Post -Headers $headers -Body @{gateName=$gateName;metric=$condition[0];op='GT';error=$condition[1]} | Out-Null
    } elseif ($current.error -ne $condition[1] -or $current.op -ne 'GT') { throw 'Gate local tiene condiciones distintas: revisar sin bajar umbrales' }
}
Invoke-RestMethod "$url/api/qualitygates/select" -Method Post -Headers $headers -Body @{gateName=$gateName;projectKey=$key} | Out-Null
Invoke-RestMethod "$url/api/settings/set" -Method Post -Headers $headers -Body @{component=$key;key='sonar.qualitygate.ignoreSmallChanges';value='false'} | Out-Null
$tokenName='codex-local-'+[guid]::NewGuid().ToString('N')
$token=Invoke-RestMethod "$url/api/user_tokens/generate" -Method Post -Headers $headers -Body @{name=$tokenName}
$env:SONAR_TOKEN=$token.token
$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.10'
Push-Location $repo
try {
    & ./mvnw.cmd -B -ntp sonar:sonar "-Dsonar.host.url=$url" "-Dsonar.projectKey=$key" '-Dsonar.qualitygate.wait=true' '-Dsonar.scanner.skipJreProvisioning=true' *> (Join-Path $output 'scanner.log')
    $exitCode=$LASTEXITCODE
    Get-Content (Join-Path $output 'scanner.log') -Tail 18
    if ($exitCode -ne 0) { throw 'Scanner o Quality Gate no aprobado; ver scanner.log' }
} finally {
    Remove-Item Env:SONAR_TOKEN -ErrorAction SilentlyContinue
    Invoke-RestMethod "$url/api/user_tokens/revoke" -Method Post -Headers $headers -Body @{name=$tokenName} | Out-Null
    Pop-Location
}

