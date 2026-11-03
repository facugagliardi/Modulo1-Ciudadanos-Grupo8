# Integración M1–M6: directorio e identidad

Estado: implementado localmente; requiere migración `db/06_consultas_m6.sql` y despliegue. La base actual del backend es `https://ciudadanos-m1-backend.onrender.com`. La disponibilidad de esa base no implica que estas rutas nuevas estén desplegadas.

## Tokens de usuarios (existentes)

HS256, issuer predeterminado `modulo1-ciudadanos`, access 900 segundos. Claims: `iss`, `sub` numérico serializado como string, `sub_type`, `rol`, `typ`, `actorType`, `actorId`, `iat`, `exp`. En ciudadanos se incluye `citizenId` igual a `actorId`; en empleados se omite. No incluye nombre ni organizationId. Los tipos son `CIUDADANO` y `EMPLEADO`. El rol no demuestra pertenencia a una empresa ni cuadrilla.

Payloads ilustrativos decodificados, sin firma ni credenciales, NO son tokens utilizables:

```json
{"iss":"modulo1-ciudadanos","sub":"101","sub_type":"CIUDADANO","rol":"PERSONA","typ":"access","actorType":"CIUDADANO","actorId":"11111111-1111-4111-8111-111111111111","citizenId":"11111111-1111-4111-8111-111111111111","iat":1793617200,"exp":1793618100}
```

```json
{"iss":"modulo1-ciudadanos","sub":"7","sub_type":"EMPLEADO","rol":"ADMINISTRATIVO","typ":"access","actorType":"EMPLEADO","actorId":"22222222-2222-4222-8222-222222222222","iat":1793617200,"exp":1793618100}
```

M6 puede conservar su clave interna `sub`. Para `updatedBy.id` usa el UUID `actorId` de la identidad autenticada que efectivamente ejecuta la acción. El directorio permite precargar identidades, pero no prueba quién ejecutó una acción. Un sub aislado es ambiguo: ciudadano 7 y empleado 7 son personas/cuentas distintas.

## Consultas preparadas

Todas GET bajo `/integraciones/v1`. Respuestas directas, sin wrapper `items`, sin eventos automáticos y sin credenciales, DNI, domicilio, correo o fecha de nacimiento.

| Ruta | Respuesta de ejemplo |
|---|---|
| `/ciudadanos/{citizenId UUID}` | `{"citizenId":"11111111-1111-4111-8111-111111111111","nombre":"Ana","apellido":"Ejemplo","estado":"ACTIVO"}` |
| `/organizaciones/{organizationId UUID}` | `{"organizationId":"33333333-3333-4333-8333-333333333333","cuit":"30712345678","razonSocial":"Contratista de ejemplo","nombre":"Ejemplo","estado":"ACTIVA"}` |
| `/organizaciones?cuit=30712345678` | Mismo formato que organización por UUID |
| `/actores?actorType=EMPLEADO&sub=7` | `{"sub":"7","actorType":"EMPLEADO","actorId":"22222222-2222-4222-8222-222222222222","nombre":"Luis","apellido":"Ejemplo","estado":"ACTIVO"}` |

`actorType` también admite `CIUDADANO`. El UUID ya existe en la cuenta y se obtiene antes de su primer login. No hay creación automática de personas ni búsqueda global por nombre. Para personas que no estén dadas de alta, se responde 404.

Organización: estados `PENDIENTE`, `ACTIVA`, `INACTIVA`, `BLOQUEADA`, `RECHAZADA`. Ciudadano: `ACTIVO`, `INACTIVO`, `FALLECIDO`, `BLOQUEADO`. Empleado: `ACTIVO`, `INACTIVO`. Un registro inactivo devuelve 200 y su estado real; M6 debe rechazar una asignación nueva si no está activo. Inexistente 404; parámetros inválidos 400; sin token válido 401; sin permiso 403. CUIT de 11 dígitos sin separadores.

Las organizaciones reciben UUID persistido mediante la migración; se conservan los IDs numéricos históricos y los contratos anteriores. Estos UUID nuevos se deben comunicar al consumir este directorio, sin asumir que los eventos históricos ya usaban UUID.

## Autenticación acordada con M6 y Core/M9

M6 obtiene un token en `POST /api/v1/auth/module-token` de Core y lo envía sin modificar como Bearer a M1. M1 eligió la validación local (opción B) para que cada consulta no dependa de una llamada sincrónica a `/auth/me` de Core.

M1 verifica la firma RS256 con la clave pública PEM entregada por M9 por canal privado, además de vencimiento y estos claims: `iss=muni-core`, `aud=muni-platform`, `kind=module`, `sub=module:ambiente` y `jti` no vacío. No espera `scope`. Tras validar, crea un sujeto técnico `SERVICIO`, cuyo único permiso es `CONSULTA_INTERMODULO`.

La lista de módulos es cerrada y comienza con `ambiente`. Esta autenticación técnica se acepta solamente bajo `/integraciones/v1/`; el mismo token no abre las demás APIs de M1. La clave vive en `APP_MODULE_AUTH_PUBLIC_KEY_PEM`, nunca en Git. M9 debe avisar antes de rotarla porque no ofrece JWKS. Falta recibir la PEM, configurar Render, aplicar la migración, desplegar y ejecutar la E2E.

## Mensaje para M6

Hola M6, gracias. Confirmamos que vamos a usar la opción B: validación RS256 local con la clave pública PEM de M9.

Ya implementamos la verificación de firma y vencimiento, `iss=muni-core`, `aud=muni-platform`, `kind=module`, `sub=module:ambiente` y `jti`. No esperamos `scope`: después de validar asignamos únicamente `CONSULTA_INTERMODULO`. El token técnico queda limitado a `/integraciones/v1/**` y no habilita las demás APIs de M1.

Tomamos también la confirmación de que todos los integrantes de cuadrillas serán `EMPLEADO`. La consulta principal queda `GET /integraciones/v1/actores?actorType=EMPLEADO&sub=...`; ustedes conservan `sub` y usan el `actorId` UUID devuelto para `updatedBy.id`.

Nos falta recibir/configurar la clave pública por privado, aplicar la migración y desplegar. Cuando esté live les enviamos la URL final y coordinamos una prueba con un module-token real. Como Core no publica JWKS, necesitamos que M9 nos avise antes de cada rotación de la PEM.
