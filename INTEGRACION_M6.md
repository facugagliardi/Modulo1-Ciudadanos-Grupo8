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

## Autenticación: punto a cerrar

Hoy M1 valida JWT de usuario HS256 y exige `CONSULTA_INTERMODULO` para estas consultas. No se habilita acceso anónimo ni se usa un empleado compartido como credencial de máquina.

El §3 del catálogo describe el token RS256 emitido por Core para autenticar operaciones con Core. No confirma por sí solo que ese token autorice consultas de datos en M1. M1 todavía NO valida module-token RS256 entrante.

Antes de habilitar M6 por ese mecanismo, cerrar con Core: si corresponde usarlo entre módulos, clave pública/JWKS y rotación, issuer/audience y claims reales, identificador exacto de M6 y autorización para consultar el directorio. Propuesta de permiso local acotado: `CONSULTA_INTERMODULO`; no asumir que Core emite un claim scope con ese nombre. Hasta entonces no hay E2E M6–M1 ni acceso de máquina anunciado como disponible.

## Mensaje para M6

Hola M6, gracias por detallar los usos. Pueden mantener `sub` como clave interna y usar `actorId` UUID para `updatedBy.id`. En nuestros access tokens de usuario viajan `sub`, `sub_type`, `rol`, `typ`, `actorType`, `actorId`, `iss`, `iat` y `exp`. `citizenId` aparece solo en ciudadanos; no en empleados. No enviamos nombre ni `organizationId` en el token.

M1 ya está hosteado en https://ciudadanos-m1-backend.onrender.com. Preparamos localmente consultas acotadas por citizenId UUID, organizationId UUID, CUIT y la equivalencia `actorType + sub → actorId` sin login previo. Las rutas y los ejemplos sanitizados están en el contrato adjunto. Estas rutas nuevas aún requieren migración y despliegue; no confirmamos disponibilidad ni E2E todavía.

Si un registro existe pero está inactivo, devolvemos su estado real; si no existe, 404. No entregamos legajos ni credenciales. La relación laboral con la contratista y la pertenencia a la cuadrilla las administra M6; M1 valida la identidad y el estado de los registros.

Sobre RS256: el §3 documenta el module-token para Core, pero M1 hoy no lo valida en sus consultas REST. Necesitamos cerrar con Core su uso entre módulos y la validación de firma/claims y permisos antes de habilitar ese acceso. No les vamos a pedir usar una cuenta de empleado compartida como token de módulo.

Para cerrar la identificación de integrantes: ¿todos son cuentas EMPLEADO municipal de M1, o también ciudadanos que trabajan para la contratista? La consulta admite ambos tipos, pero necesitamos conservar esa distinción junto con el sub numérico.
