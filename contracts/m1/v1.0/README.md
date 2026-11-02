# Contrato caseFileResolved v1.0

Contrato de data de M1 Ciudadanos para revisión y asociación en Core. Nombre exacto
del evento: `caseFileResolved` (F mayúscula). Productor: `ciudadanos`. Consumidor:
`obras`. Las relaciones activas y `maxAttempts=4` fueron confirmadas por Core.

## Archivo para asociar en Core

`caseFileResolved.data.schema.json` valida **solo el objeto `data`**. Utiliza JSON
Schema Draft 2020-12, rechaza campos adicionales y exige los seis campos emitidos
por el DTO `CaseFileResolvedData` de M1. No se envía `citizenId`: el expediente
puede ser institucional y la correlación con M3 se realiza por el UUID del proyecto.

| Campo | Contrato |
|---|---|
| caseFileId | UUID público persistente del expediente de M1 |
| caseFileNumber | Referencia humana no vacía |
| state | Literal `resolved` |
| resolution | `approved` o `rejected`, en minúsculas |
| externalReference.type | Literal `PUBLIC_WORKS_PROJECT` |
| externalReference.id | UUID recibido como publicWorksProjectId de M3 |
| resolutionSummary | Resumen no vacío del dictamen administrativo real |

Los UUID tienen `format: uuid` y un patrón explícito para mantener la comprobación
de su forma incluso si el validador de Core trata `format` solo como anotación.
El schema no puede comprobar que un UUID exista en una base ni que coincida con
un mensaje anterior; esa integridad se verifica en los handlers de negocio.

## Envelope y ejemplos

El envelope de Core lleva `eventType: caseFileResolved`, `eventVersion: "1.0"`,
`sourceModule: ciudadanos`, eventId UUID, occurredAt con offset y correlationId
UUID conservado del trámite. Estos campos están fuera de data y no los valida
este archivo. `causationId` se omite para una resolución posterior originada por
una acción administrativa; si nace directamente de otro handler, debe ser el
eventId causal, según las reglas de Core.

`examples/` contiene dos **alternativas** de mensaje completo, approved y rejected,
con identificadores ficticios. No representan dos resoluciones sucesivas de un
mismo expediente. La creación del expediente y la finalización informada por M3
no producen por sí solas este evento.

## Estado de implementación

M1 ya implementó y probó localmente los expedientes institucionales, el vínculo
por publicWorksProjectId y el consumo de aprobación/finalización. Esa adaptación
todavía no está desplegada. El DTO y el publicador de la respuesta están preparados;
su disparador automático sigue pendiente de cerrar con Obras.

La estructura de data se comparte para revisión de Core. Publicar este archivo
no implica que el schema ya haya sido cargado ni que la E2E esté aprobada. Core
debe asociarlo al evento y completar la revisión/carga de los dos schemas de M3.
La E2E también requiere verificar credenciales y red de Obras.

## Validación local

Con Python y `jsonschema==4.25.1` instalado:

```sh
python scripts/validar-contrato-casefile.py
```

El validador comprueba el metaschema, las dos alternativas y casos inválidos:
campos ausentes, UUID incorrectos, tipos, null, enums, textos en blanco y campos
extra. La URL con el SHA del commit identifica una revisión inmutable del contrato;
los cambios de la rama no modifican esa revisión.
