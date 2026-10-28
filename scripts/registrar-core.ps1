param(
    [switch]$Aplicar,
    [switch]$Consultar,
    [switch]$SoloSuscripciones,
    [ValidateSet('ticketCreated','ticketUpdated','updateTicketStatus','exemptionRequested',
        'updateExemptionStatus','paymentPlanRequested','updatePaymentPlanStatus','socialDocumentationRequested')]
    [string[]]$Suscripciones = @('ticketCreated','ticketUpdated','updateTicketStatus',
        'exemptionRequested','paymentPlanRequested','socialDocumentationRequested')
)
$ErrorActionPreference = 'Stop'
if ($Aplicar -and $Consultar) { throw 'Usar -Consultar o -Aplicar, no ambos.' }

# Sin -Aplicar muestra solamente el plan; no requiere ni imprime credenciales.
$publicaciones = @('citizenUpdated','casefileResolved','citizenInfoDelivered','organizationInfoDelivered',
    'organizationRegistered','representationGranted','representationExpired','socialDocumentationDelivered')
$coreBase = $env:CORE_API_URL
if ([string]::IsNullOrWhiteSpace($coreBase)) { $coreBase = 'https://core-uade-2026.duckdns.org/api/v1' }
[uri]$coreUri = $null
if (![uri]::TryCreate($coreBase, [System.UriKind]::Absolute, [ref]$coreUri) -or $coreUri.Scheme -ne 'https' -or
    $coreUri.UserInfo -or $coreUri.Query -or $coreUri.Fragment -or $coreUri.AbsolutePath.TrimEnd('/') -notin @('', '/api/v1')) {
    throw 'CORE_API_URL debe ser HTTPS y terminar en /api/v1 o en la raiz del host, sin credenciales ni query.'
}
$coreBase = $coreUri.GetLeftPart([System.UriPartial]::Authority) + '/api/v1'
if ($SoloSuscripciones) { $publicaciones = @() }
if (!$Aplicar -and !$Consultar) {
    [pscustomobject]@{
        Api=$coreBase
        Publicaciones=$publicaciones
        Suscripciones=$Suscripciones
        PendientesDeConfirmacionConRentas=@('updateExemptionStatus','updatePaymentPlanStatus')
    } | ConvertTo-Json
    return
}

$coreSecret = $env:CORE_MODULE_SECRET
if ([string]::IsNullOrWhiteSpace($coreSecret)) {
    throw 'Definir CORE_MODULE_SECRET por el canal privado del PO. El script no genera ni cambia secretos.'
}
$coreHeaders = @{}
function Invoke-Core([string]$Method, [string]$Path, $Body) {
    $request = @{ Method=$Method; Uri="$coreBase$Path"; Headers=$coreHeaders; TimeoutSec=30 }
    if ($null -ne $Body) { $request.ContentType='application/json'; $request.Body=($Body | ConvertTo-Json -Compress) }
    try { Invoke-RestMethod @request }
    catch {
        $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'sin respuesta' }
        # Evitar que el error muestre el body del intercambio de credenciales.
        throw "Core: $Method $Path fallo (HTTP $status). Revisar conexion/contrato con Core."
    }
}
$token = Invoke-Core 'POST' '/auth/module-token' @{ module='ciudadanos'; secret=$coreSecret }
if (!$token.accessToken) { throw 'Core no devolvio accessToken; no se modifico el catalogo.' }
$coreHeaders.Authorization = "Bearer $($token.accessToken)"
if ($Consultar) {
    Invoke-Core 'GET' '/event-types/map' $null | ConvertTo-Json -Depth 12
    return
}
foreach ($tipo in $publicaciones) {
    $null = Invoke-Core 'POST' '/publications' @{ eventType=$tipo }
    Write-Output "Publicacion registrada: $tipo"
}
foreach ($tipo in $Suscripciones) {
    $null = Invoke-Core 'POST' '/subscriptions' @{ eventType=$tipo; maxAttempts=4 }
    Write-Output "Suscripcion registrada: $tipo"
}
Invoke-Core 'GET' '/event-types/map' $null | ConvertTo-Json -Depth 12
