# Problemas detectados en el backend del Módulo 1

> Lo que encontramos construyendo el frontend contra el backend real. Cada
> entrada dice **qué pasa**, **cómo se comprobó**, **qué hace el front mientras
> tanto** y **qué haría falta** del lado del backend.
>
> No son quejas: casi todo tiene una salida razonable y el front ya la tomó. Esto
> es para que el equipo decida qué se arregla antes de la entrega y qué queda
> documentado como límite conocido.
>
> Última revisión: **6 de septiembre de 2026**, contra el backend corriendo con
> PostgreSQL y MongoDB.

| # | Problema | Severidad |
|---|---|:--:|
| [1](#1-el-backend-no-arranca-en-windows-con-hora-de-argentina) | El backend no arranca en Windows con hora de Argentina | 🔴 Bloqueante |
| [2](#2-dbmongodb_setuptxt-no-se-puede-ejecutar) | `db/mongodb_setup.txt` no se puede ejecutar como documenta el README | 🟠 Alta |
| [3](#3-una-persona-jurídica-no-puede-ver-ni-editar-sus-datos) | Una persona jurídica no puede ver ni editar sus datos | 🟠 Alta |
| [4](#4-no-se-puede-descargar-ni-ver-un-documento-subido) | No se puede descargar ni ver un documento subido | 🟠 Alta |
| [5](#5-no-hay-listado-global-de-documentos) | No hay listado global de documentos | 🟡 Media |
| [6](#6-no-existe-organizaciones-donde-soy-dueño) | No existe "organizaciones donde soy dueño" | 🟡 Media |
| [7](#7-rf-07-no-se-puede-cumplir-entero) | RF-07 no se puede cumplir entero | 🟡 Media |
| [8](#8-ningún-cambio-de-estado-acepta-motivo) | Ningún cambio de estado acepta `motivo` | 🟡 Media |
| [9](#9-el-backend-no-valida-dos-reglas-del-alcance) | El backend no valida dos reglas del alcance | 🟡 Media |
| [10](#10-la-verificación-de-contactos-no-verifica-nada) | La verificación de contactos no verifica nada | 🟡 Media |
| [11](#11-los-listados-no-filtran-ni-paginan) | Los listados no filtran ni paginan | 🟢 Por diseño |
| [12](#12-architecturemd-está-desactualizado) | `ARCHITECTURE.md` está desactualizado | 🟢 Documentación |
| [13](#13-límites-ya-documentados-por-el-propio-backend) | Límites ya documentados por el propio backend | 🟢 Conocidos |
| [14](#14-no-hay-listado-global-de-representaciones) | No hay listado global de representaciones | 🟡 Media |
| [15](#15-no-se-puede-dar-de-alta-a-un-vecino-sin-inventarle-una-contraseña) | No se puede dar de alta a un vecino sin inventarle una contraseña | 🟠 Alta |

---

## 1. El backend no arranca en Windows con hora de Argentina

**Severidad**: 🔴 Bloqueante — le pasa a cualquiera del equipo con esa zona horaria.

La JVM toma la zona horaria de Windows como `America/Buenos_Aires`, que **no es un
nombre IANA válido**; el correcto es `America/Argentina/Buenos_Aires`. El driver
JDBC se la pasa a PostgreSQL 16 como parámetro de sesión y el servidor la
rechaza:

```
FATAL: invalid value for parameter "TimeZone": "America/Buenos_Aires"
org.hibernate.exception.DataException: unable to obtain isolated JDBC connection
```

El arranque muere antes de levantar el `EntityManagerFactory`.

**Cómo lo comprobamos**: `./mvnw spring-boot:run` falla con ese error; con la zona
válida arranca sin tocar nada más.

**Mientras tanto** se levanta así:

```bash
./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-Duser.timezone=America/Argentina/Buenos_Aires"
```

**Qué haría falta**: fijar la zona en `application.yml` o en el `pom.xml` para que
no dependa de la máquina. Cualquiera de las dos alcanza:

```yaml
spring:
  jpa:
    properties:
      hibernate.jdbc.time_zone: UTC
  datasource:
    hikari:
      data-source-properties:
        options: "-c TimeZone=UTC"
```

---

## 2. `db/mongodb_setup.txt` no se puede ejecutar

**Severidad**: 🟠 Alta — el comando que documenta el README falla.

El archivo arranca con un encabezado en texto plano **sin comentar**, así que
`mongosh --file` tira `SyntaxError: Unexpected token (1:0)` en la primera línea.

**Cómo lo comprobamos**: el comando del README
(`mongosh "mongodb://localhost:27017" --file db/mongodb_setup.txt`) falla. Las
colecciones igual terminan creándose porque `mongosh` sigue después de cada
error, pero el script no corre entero y nadie puede saber qué quedó sin aplicar.

**Mientras tanto**: se ejecuta salteando el encabezado.

**Qué haría falta**: comentar las líneas del encabezado con `//`, o mover esa
explicación a un `.md` aparte y dejar el archivo como JavaScript puro.

---

## 3. Una persona jurídica no puede ver ni editar sus datos

**Severidad**: 🟠 Alta — hay un tipo de usuario que puede registrarse y entrar,
pero no tiene pantalla de perfil.

No existe ningún `PersonaJuridicaController`: son once controllers y ninguno es
de jurídicas. `GET /ciudadanos/{id}` resuelve contra `ciudadanoRepository`
(`CiudadanoService.buscar()`), así que a una jurídica le devuelve **404**.

Sí le funcionan las rutas montadas sobre `/personas/{id}`: domicilios,
documentos y representaciones.

**Mientras tanto**: el portal tiene dos variantes. Una jurídica no ve "Mis datos"
ni "Grupo familiar", y una guarda de ruta la desvía si entra por URL.

**Qué haría falta**: `GET` y `PUT /personas-juridicas/{id}`, con el mismo criterio
de autorización que el de ciudadanos.

---

## 4. No se puede descargar ni ver un documento subido

**Severidad**: 🟠 Alta — se puede subir documentación pero nadie puede abrirla.

`AlmacenamientoLocal.guardar()` devuelve `destino.toUri().toString()`, o sea un
`file:///C:/.../archivos-documentos/documento-1-v1.pdf`. Eso es una ruta del
**disco del servidor**: un navegador no la puede abrir, y no hay ningún endpoint
que devuelva el binario.

**Consecuencia**: el empleado que tiene que validar un documento **no puede
verlo**. Aprueba o rechaza a ciegas.

**Cómo lo comprobamos**: subimos un PDF desde el portal; quedó en disco como
`documento-1-v1.pdf` y en la base con ese `file://` en `url_archivo`.

**Mientras tanto**: el front no ofrece el archivo como enlace. Prometer una
descarga que falla es peor que no ofrecerla.

**Qué haría falta**: `GET /documentos/{id}/archivo` que devuelva el binario con su
`Content-Type`, con la misma autorización que `GET /documentos/{id}`.

---

## 5. No hay listado global de documentos

**Severidad**: 🟡 Media.

El único listado es `GET /personas/{personaId}/documentos`. No hay forma de pedir
"todos los documentos pendientes de validación".

**Consecuencia**: no se puede construir una bandeja de validación. El empleado
tiene que entrar al legajo de cada persona.

**Mientras tanto**: la validación vive en la pestaña Documentos del legajo, y la
pantalla de Documentación lo dice explícitamente para que nadie la busque.

**Qué haría falta**: `GET /documentos?resultado=PENDIENTE`, aunque devuelva el
listado completo como los demás.

---

## 6. No existe "organizaciones donde soy dueño"

**Severidad**: 🟡 Media.

Hay `GET /organizaciones` (resumen, **sin** el array `duenos`) y
`GET /organizaciones/{id}/duenos`, pero ninguna consulta inversa por persona.
Armar "mis organizaciones como dueño" obligaría a bajar todas y hacer una
consulta por cada una.

**Mientras tanto**: "Mis organizaciones" se arma con
`GET /personas/{sub}/representaciones`, que sí es directo. La titularidad se
resuelve al entrar al detalle.

**Qué haría falta**: `GET /personas/{id}/organizaciones`.

---

## 7. RF-07 no se puede cumplir entero

**Severidad**: 🟡 Media — es un requerimiento funcional del propio alcance.

RF-07 pide buscar ciudadanos por **DNI, nombre, domicilio, teléfono o correo**.
`GET /ciudadanos` devuelve sólo `id, dni, nombre, apellido, fechaNacimiento,
cuil, estado`: no trae domicilio ni contacto, así que esos tres criterios no se
pueden buscar.

**Mientras tanto**: el padrón busca por nombre, apellido, DNI y CUIL.

**Qué haría falta**: que el listado incluya domicilio principal y contactos, o un
endpoint de búsqueda.

---

## 8. Ningún cambio de estado acepta `motivo`

**Severidad**: 🟡 Media.

La regla 11 del documento de alcance dice: *"Toda transición de estado exige
motivo y queda auditada con usuario y fecha"*. Los `PATCH .../estado` sólo
reciben `{estado}` (y `documentoId` en solicitudes). El usuario y la fecha sí
quedan; el motivo no existe.

**Consecuencia**: bloquear a un vecino o marcarlo fallecido queda sin
justificación asentada, que es justo lo que la regla quería evitar.

**Mientras tanto**: el front no lo pide, porque el backend lo rechazaría por
campo desconocido.

**Qué haría falta**: agregar `motivo` a los DTO de cambio de estado y persistirlo.

---

## 9. El backend no valida dos reglas del alcance

**Severidad**: 🟡 Media.

- **Regla 8**: *"Un expediente no pasa a RESOLVED sin al menos una actuación"*.
  El backend deja resolver un expediente con cero actuaciones.
- **Regla 5**: *"Un ciudadano DECEASED no admite operaciones ni cambios de
  estado"*. `FALLECIDO` es terminal para el estado, pero nada impide seguir
  editando sus datos, domicilios o contactos.

**Mientras tanto**: el front bloquea la primera —la opción "Resuelto" aparece
deshabilitada con el motivo— pero **es sólo cosmético**: cualquiera que llame a
la API directamente la saltea.

**Qué haría falta**: validarlas en el servicio, que es donde tienen efecto real.

---

## 10. La verificación de contactos no verifica nada

**Severidad**: 🟡 Media. Ya está declarado como límite conocido en el README del
backend, pero conviene tenerlo acá porque se ve en la interfaz.

`PATCH /contactos/{id}/verificar` acepta **cualquier** código de seis dígitos: no
hay emisión ni almacenamiento de códigos.

**Mientras tanto**: el front muestra el flujo completo y lo dice en el texto de
ayuda del campo, en vez de simular un envío que no ocurre.

**Qué haría falta**: una tabla de códigos con vencimiento y el envío por
correo/SMS (que según el alcance es del M9).

---

## 11. Los listados no filtran ni paginan

**Severidad**: 🟢 Por diseño — está decidido así en la spec v2, no es un error.

Todos los `GET` de listado devuelven el conjunto completo en `{items: [...]}` y
no aceptan query params.

**Mientras tanto**: `<Tabla>` resuelve búsqueda, filtros, orden y paginación del
lado del cliente, que además es lo que el enunciado le pide al frontend.

**A tener en cuenta**: si el padrón crece, bajarlo entero en cada carga deja de
ser viable. La solución correcta serían query params en el backend, no más
trucos en el front.

---

## 12. `ARCHITECTURE.md` está desactualizado

**Severidad**: 🟢 Documentación — pero hace escribir código equivocado.

Diferencias verificadas contra el código:

| `ARCHITECTURE.md` dice | El código hace |
|---|---|
| `POST /organizaciones` recibe `personaId[]` | Recibe `duenos: [{personaId, porcentajeTitularidad}]` |
| `DELETE /domicilios/{id}` → `{propiedadId, vigenteHasta}` | Devuelve además `nuevoPrincipalId` |
| `POST /auth/refresh` → "200/204" | Siempre **204**, y devuelve los **tres** headers |
| `PATCH .../estado` → `{organizacionId, ...}` | Siempre `CambioEstadoResponse` con el campo **`id`** |
| `GET /ciudadanos/{id}/relaciones` sin nombre | Trae `nombre` y `apellido` |
| `GET /personas/{id}/domicilios` sin coordenadas | Trae `altura`, `idBarrio`, `longitud`, `latitud` |
| `PATCH /documentos/{id}/validar` sin `vigenciaHasta` | Lo acepta y lo devuelve |
| `GET /expedientes/{id}/actuaciones` sin `expedienteId` | Lo trae en cada item |
| `POST /expedientes` marcado "a confirmar" | Está implementado y funciona |

El `README.md` del backend, en cambio, está bien mantenido.

**Qué haría falta**: actualizar `ARCHITECTURE.md` o marcarlo como histórico y
apuntar al README.

---

## 13. Límites ya documentados por el propio backend

El README del backend los declara en "Limitaciones conocidas". Los repetimos acá
porque se notan desde la interfaz:

- **Los eventos no se publican ni se consumen.** `EventoOutbox` existe pero no hay
  productor ni publisher. Por eso el portal no puede armar la línea de tiempo del
  vecino con hechos de otros módulos, que es una de las promesas del alcance.
- **`POST /auth/logout` no revoca nada.** Un access token robado sigue siendo
  válido hasta que vence.
- **El versionado de documentos pisa la fila.** No hay historial consultable, así
  que el front no ofrece "ver versiones anteriores".
- **El número de expediente se calcula contando filas.** Bajo concurrencia dos
  altas simultáneas pueden chocar contra la unicidad.
- **Los archivos van al disco local.** Con más de una instancia desplegada deja de
  funcionar. Relevante para la entrega, que pide despliegue.
- **El rol `SERVICIO` no se emite.** Hoy las consultas inter-módulo las cubren los
  roles de empleado.
- **No hay empleado semilla con rol `ADMINISTRATIVO`.** Para probar
  `VALIDAR_DOCUMENTACION` en el escalón del medio hay que insertarlo a mano.

---

## 14. No hay listado global de representaciones

**Severidad**: 🟡 Media. Es el hermano del punto 5.

Las representaciones sólo se pueden listar por organización
(`GET /organizaciones/{id}/representaciones`) o por persona
(`GET /personas/{id}/representaciones`). No hay forma de pedir "todas las
representaciones vigentes que vencen en los próximos 30 días".

**Consecuencia**: el tablero **no puede** mostrar ese indicador, que estaba en el
plan y es de los más útiles para el municipio: una representación vencida deja a
una organización sin nadie que pueda tramitar por ella, y el Módulo 4 depende de
eso para autorizar habilitaciones. Calcularlo hoy exigiría una consulta por cada
organización.

Por la misma razón tampoco está el indicador de **documentos pendientes de
validación** (punto 5).

**Mientras tanto**: los dos indicadores quedaron fuera del tablero, y está
anotado en `sitemap.md` para que nadie los busque.

**Qué haría falta**: `GET /representaciones` con el listado completo, igual que
los demás. Con eso los dos indicadores salen sin tocar nada más del front.

---

## 15. No se puede dar de alta a un vecino sin inventarle una contraseña

**Severidad**: 🟠 Alta — afecta al alta asistida, que es una de las funciones
centrales de mesa de entradas según el alcance.

El único endpoint de alta de persona es `POST /auth/register`, y **exige
`password`**. No hay un alta administrativa sin credencial, ni un mecanismo de
invitación o de primera contraseña.

Consecuencias, en cadena:

1. El empleado tiene que **elegir la contraseña de otra persona**.
2. Como el envío de notificaciones es del M9 y los eventos todavía no se
   publican, **no hay forma de hacérsela llegar**: sólo dársela en mano.
3. Esa contraseña queda válida hasta que el vecino la cambie — y **no hay
   endpoint para cambiar la contraseña**, así que en la práctica queda para
   siempre.

**Cómo lo comprobamos**: dimos de alta a un vecino desde el mostrador y entramos
con la clave generada; el login devolvió 200 sin pedir ningún cambio.

**Mientras tanto**: la pantalla genera una contraseña provisoria legible —sin
caracteres que se confundan al dictarla, nada de `l` contra `1`— y la muestra una
sola vez, diciendo con todas las letras que hay que entregarla en mano y que el
sistema no manda correos. Es lo más honesto que se puede hacer con esta API.

**Qué haría falta**, de menor a mayor:

- `PATCH /personas/{id}/password` para que el vecino pueda cambiarla.
- Un alta administrativa sin contraseña, que deje la cuenta pendiente de
  activación.
- A más largo plazo, que la credencial la emita el M9, que es lo que dice el
  alcance: *"Módulo 9 = proveedor de identidad. Dueño de credenciales"*.

---

## Diferencias con el documento de alcance

No son errores del backend, son decisiones que el equipo tomó distinto de lo que
dice el documento de alcance. Convienen resolverse antes de congelar contratos
con los otros ocho módulos.

- **Nomenclatura.** El alcance fija "código en inglés" (`/api/v1/citizens/{id}`,
  `citizenId`, roles `CITIZEN`/`SUPERVISOR`, estados `ACTIVE`/`DECEASED`). El
  backend está íntegramente en castellano y sin `/api/v1`. Los otros módulos
  leyeron el documento de alcance.
- **Roles.** Seis en el alcance, seis en el código, pero no son los mismos: no hay
  equivalente directo de `AREA_OWNER`, y `SERVICIO` no existe en el alcance.
- **Estados de expediente.** El alcance define `PENDING_INFO`; el backend tiene
  cuatro estados y no lo incluye. "Esperando documentación" hay que inferirlo
  cruzando con las solicitudes pendientes del titular.
