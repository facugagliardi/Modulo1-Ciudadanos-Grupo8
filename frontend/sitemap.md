# Sitemap — Frontend del Módulo 1

> **Qué es esto**: el mapa de pantallas de la aplicación. Cada una con su ruta,
> quién entra, qué endpoints consume, qué acciones ofrece y qué estados tiene.
>
> Los otros dos documentos: [`contexto.md`](contexto.md) dice *cómo hablar con la
> API* (los 59 endpoints, campo por campo). [`DISENO.md`](DISENO.md) dice *cómo
> se ve y por qué*. Este dice *qué pantallas hay*.
>
> Marca de estado: ✅ construida · 🚧 especificada, sin construir.

---

## 1. Una sola aplicación, dos zonas

Un proyecto y un despliegue. Al ingresar, el claim `sub_type` del JWT decide a
qué zona entra la persona; el claim `rol`, qué ve dentro.

```
/                          redirige según la sesión
/ingresar                  ✅ vecino y empleado, con interruptor
/registro                  ✅ alta de persona física o jurídica
/sin-permiso               ✅ 403 explicado
*                          ✅ 404

/portal/*                  PORTAL DEL VECINO      (rol PERSONA)
  /portal                  ✅ Mis trámites
  /portal/perfil           ✅ Mis datos            · sólo CIUDADANO
  /portal/domicilios       ✅ Mis domicilios
  /portal/contactos        ✅ Mi contacto          · sólo CIUDADANO
  /portal/familia          ✅ Mi grupo familiar    · sólo CIUDADANO
  /portal/organizaciones   ✅ Mis organizaciones
    /nueva                 ✅ Registrar organización
    /:id                   ✅ Detalle
  /portal/documentos       ✅ Mis documentos
  /portal/documentacion-solicitada  ✅ Lo que me piden
  /portal/expedientes      ✅ Mis expedientes
    /:id                   ✅ Carátula y actuaciones

/admin/*                   BACKOFFICE             (empleados)
  /admin                   ✅ Tablero de indicadores
  /admin/padron            ✅ Padrón de vecinos
    /nuevo                 ✅ Alta asistida
    /:id                   ✅ Legajo del vecino
  /admin/organizaciones    ✅ Listado
    /nueva                 ✅ Alta
    /:id                   ✅ Detalle, dueños, representaciones
  /admin/documentacion     ✅ Solicitudes (se pide desde un diálogo)
    /:id (legajo) → tab   ✅ Documentos y validación, en /admin/padron/:id
  /admin/expedientes       ✅ Listado
    /nuevo                 ✅ Iniciar expediente
    /:id                   ✅ Carátula y actuaciones
  /admin/consultas         🚧 Consultas inter-módulo
```

### Cómo se decide la zona

`RutaProtegida` exige sesión. `RutaDeZona` compara el rol: los cuatro roles de
empleado van a `/admin`, `PERSONA` va a `/portal`, y si alguien entra a la zona
que no le toca se lo manda a la suya sin error. `RequierePermiso` cuida las
pantallas que además necesitan un permiso concreto.

Están en [`src/rutas/guardas.jsx`](src/rutas/guardas.jsx). **No son seguridad**:
el backend valida igual y devuelve 403. Evitan que alguien llegue a una pantalla
que no puede usar.

---

## 2. Zona pública

### `/ingresar` ✅
**Quién** cualquiera · **Endpoints** `POST /auth/login` · `POST /auth/empleados/login`

Un solo lugar con un interruptor "Soy vecino / Soy empleado", porque el backend
tiene dos endpoints con campos distintos: el vecino se identifica con CUIT/CUIL,
el empleado con su correo. Dos pantallas separadas obligarían a adivinar cuál te
toca.

- **Validación** CUIT/CUIL de 11 dígitos (acepta guiones); correo con formato; contraseña presente.
- **Estados** enviando · error del backend en un `role="alert"`.
- **Después** al portal o al backoffice según `sub_type`; si venía de una ruta protegida, vuelve ahí.
- **Ojo** los tokens vienen en los **headers**, no en el cuerpo.

### `/registro` ✅
**Quién** cualquiera · **Endpoints** `POST /auth/register` → encadena `POST /auth/login`

Primero se elige qué se registra (persona u organización) y recién ahí aparecen
los campos que corresponden: el backend tiene un solo cuerpo donde `tipo` decide
qué bloque se exige, y mostrar los diez campos juntos obligaría a descartar la
mitad.

- **Validación** contraseña ≥ 8 · DNI 7–9 dígitos · fecha de nacimiento pasada · CUIT/CUIL 11 dígitos · razón social y nombre de fantasía si es organización.
- **Errores** 409 → "Ya hay una cuenta registrada con ese CUIT o DNI"; los 400 con detalle se pintan campo por campo.
- **Ojo** `register` **no** devuelve tokens: se hace el login automáticamente. El domicilio se carga después, y la pantalla lo dice.

### `/sin-permiso` ✅ y `*` (404) ✅
El 403 nombra el rol que tiene la persona y el permiso que faltó, con el mismo
criterio que usan los mensajes del backend.

---

## 3. Portal del vecino

> **Dos variantes.** Una persona jurídica ve menos secciones que un ciudadano:
> el backend **no tiene** endpoint de perfil ni de grupo familiar para jurídicas
> (ver §6). Sí le funcionan domicilios, documentos y representaciones, que
> cuelgan de `/personas/{id}`.

### `/portal` — Mis trámites ✅
**Endpoints** `GET /ciudadanos/{sub}` · `GET /solicitudes-documentacion` · `GET /expedientes` · `GET /personas/{sub}/representaciones`

La vista consolidada que pide el alcance. Cuatro bloques: mis datos, lo que me
piden (solicitudes pendientes, con el plazo destacado y en rojo si venció), mis
expedientes recientes y mis organizaciones.

- **Vacío** si no hay nada pendiente, decirlo en positivo: "No tenés trámites pendientes".
- **Ojo** la línea de tiempo con hechos de otros módulos **no se puede armar todavía**: el backend no consume eventos.

### `/portal/perfil` — Mis datos ✅ · sólo CIUDADANO
**Endpoints** `GET /ciudadanos/{sub}` · `PUT /ciudadanos/{sub}`
Formulario con los **cinco** campos que el DTO acepta: nombre, apellido, fecha de
nacimiento, DNI, CUIL. Es parcial. `estado` no se toca desde acá.

### `/portal/domicilios` ✅
**Endpoints** `GET`/`POST /personas/{sub}/domicilios` · `PUT`/`DELETE /domicilios/{id}` · `PATCH /domicilios/{id}/principal`

Línea de tiempo: el vigente arriba y destacado, los cerrados abajo en gris. El
domicilio no se modifica, se cierra el vigente y se abre uno nuevo — la pantalla
tiene que hacer evidente esa regla, no esconderla.

- **Acciones** agregar · editar · marcar principal · cerrar vigencia.
- **Ojo** `PUT` **no** es parcial (tipo, calle y número obligatorios) · `PATCH .../principal` va **sin cuerpo** · `DELETE` devuelve **200 con cuerpo** y da **409** si es el único principal: deshabilitar el botón en ese caso en vez de dejar que se coma el error.

### `/portal/contactos` ✅ · sólo CIUDADANO
**Endpoints** `GET`/`POST /ciudadanos/{sub}/contactos` · `PUT`/`DELETE /contactos/{id}` · `PATCH /contactos/{id}/verificar`
- **Ojo** editar un contacto lo vuelve no verificado · el backend normaliza (correo a minúsculas, teléfono sin espacios): mostrar lo que devuelve la respuesta · 409 si el contacto ya existe.
- **Ojo** la verificación **no verifica nada** todavía: cualquier código de 6 dígitos pasa. Se puede mostrar el flujo completo sabiendo eso.

### `/portal/familia` ✅ · sólo CIUDADANO
**Endpoints** `GET /ciudadanos/{sub}/relaciones` · `POST /relaciones` · `PUT`/`DELETE /relaciones/{id}` · `PATCH /relaciones/{id}/responsable`
El vínculo se declara desde los dos extremos. Para dar de alta hace falta el id
de la otra persona, y la única forma de conseguirlo es buscarla por DNI
(`GET /ciudadanos/dni/{dni}`, que nunca da 404): por eso el alta tiene dos pasos.

- **El recíproco se propone sólo cuando el vínculo lo determina** (`reciprocoDe`
  en `listasBlancas.js`). Para padre/madre, hijo/hija y hermano/hermana **no se
  propone nada**: dependen del género de la otra persona, que el sistema no
  guarda, y suponerlo escribiría un dato falso en el registro civil.
- El listado ya trae nombre y apellido del otro extremo.

### `/portal/organizaciones` ✅
**Endpoints** `GET /personas/{sub}/representaciones` · `GET /organizaciones/{id}` · `POST /organizaciones`
Se arma con las representaciones, que es la consulta directa que existe. **No hay
endpoint "organizaciones donde soy dueño"** (§6): la titularidad se resuelve al
entrar al detalle.

### `/portal/documentos` ✅
**Endpoints** `GET`/`POST /personas/{sub}/documentos` (multipart) · `GET /documentos/{id}` · `POST /documentos/{id}/version`
- **Ojo** campo `archivo` + `tipoDocumento`; no fijar `Content-Type` a mano; validar tamaño y extensión **antes** de subir para no comerse un 413.
- **Ojo** el versionado pisa la fila: **no prometas "ver versiones anteriores"**, el backend no las expone.

### `/portal/documentacion-solicitada` ✅
**Endpoints** `GET /solicitudes-documentacion` · `POST /personas/{sub}/documentos` · `PATCH /solicitudes-documentacion/{id}/estado`

Lo que el municipio le pide al vecino, con el plazo. **El flujo son dos pedidos
encadenados**: subir el documento, tomar el `documentoId` y recién ahí cerrar la
solicitud con `estado: CUMPLIDA` + `documentoId`. Para la persona tiene que ser
una sola acción.

### `/portal/expedientes` y `/portal/expedientes/:id` ✅
**Endpoints** `GET /expedientes` · `GET /expedientes/{id}` · `GET /expedientes/{id}/actuaciones`
Sin `LEER_TERCEROS` el backend devuelve sólo los propios: no hace falta filtrar.
El detalle es **la carátula** (ver `DISENO.md`).

---

## 4. Backoffice

### `/admin` — Tablero ✅
**Endpoints** `GET /ciudadanos` · `GET /organizaciones` · `GET /expedientes` · `GET /solicitudes-documentacion`

Requisito explícito de la cátedra. Se arma **enteramente en el front** con cuatro
consultas, agregando en memoria los listados completos que el backend obliga a
bajar igual: la restricción que en las tablas es un costo, acá sale gratis.

**Orden de la pantalla**: primero lo que reclama una acción, después la
composición. Un responsable de área entra a saber qué falta hacer.

| # | Indicador | Forma |
|---|---|---|
| 1 | Tamaño del padrón, con activos, organizaciones y expedientes | cifra que encabeza |
| 2 | **Expedientes sin ninguna actuación** — trabajo estancado | indicador |
| 3 | **Solicitudes con el plazo vencido** y aún pendientes | indicador |
| 4 | Solicitudes que vencen en 7 días | indicador |
| 5 | Vecinos por estado | barras |
| 6 | Expedientes por estado | barras |
| 7 | Expedientes por área iniciadora | barras |
| 8 | Organizaciones por tipo | barras |

Dos aritméticas que parecen detalles y no lo son: un expediente **archivado** sin
actuaciones no está estancado, está cerrado; y una solicitud vencida que ya se
**cumplió** no reclama nada.

**Quedaron afuera** dos indicadores del plan original —representaciones por
vencer y documentos pendientes de validación— porque ninguna de las dos entidades
tiene listado global. Ver `issues.md`, puntos 5 y 14.

**Cómo están hechos los gráficos** (ver `DISENO.md`):
- **Todas las barras llevan la misma tinta.** Colorearlas por su valor gastaría
  el canal del color repitiendo lo que el largo ya dice. La identidad la lleva la
  etiqueta: para los estados, el mismo `<BadgeEstado>` del resto del sistema.
- **El valor va en la punta de la barra**, no en un tooltip: un dato que sólo se
  lee con el mouse no existe para quien usa teclado.
- **Cada gráfico tiene su tabla gemela**, con recuento y porcentaje.
- Las categorías nominales van ordenadas de mayor a menor; los estados siguen su
  recorrido real (el embudo del expediente, no el alfabeto).

### `/admin/padron` ✅
**Permiso** `LISTAR_PADRON` · **Endpoint** `GET /ciudadanos`

`GET /ciudadanos` devuelve el padrón **entero**, sin filtros ni paginación:
buscar, filtrar, ordenar y paginar es del front, y lo resuelve `<Tabla>`.

- **Columnas** vecino · DNI · CUIL · nacimiento con edad · estado.
- **Búsqueda** nombre, apellido, DNI, CUIL — **sin acentos** ("perez" encuentra a Pérez).
- **Filtro** estado. **Orden** por cualquier columna. **Paginación** 25/50/100.
- **Acción** "Registrar vecino", sólo con `EDITAR_TERCEROS` (el auditor no la ve).
- **Límite conocido** RF-07 pide buscar también por domicilio, teléfono y correo; el listado no trae esos datos. Anotado en §6.

### `/admin/padron/nuevo` — Alta asistida ✅
**Permiso** `EDITAR_TERCEROS` · **Endpoints** `GET /ciudadanos/dni/{dni}` · `POST /auth/register`

Para quien se acerca al mostrador. El domicilio y el contacto se cargan después,
desde el legajo.

- **Chequeo de DNI en vivo** mientras se escribe (con 400 ms de respiro).
  `GET /ciudadanos/dni/{dni}` nunca devuelve 404: responde `{existe:false}`. Si ya
  existe, se avisa quién es, se ofrece abrir su legajo y **se bloquea el alta** —
  un duplicado en el padrón es peor que un error de formulario.
- **Ojo** el alta NO puede encadenar el login como hace el registro público: eso
  sacaría al empleado de su propia sesión. Para eso está `registrarPersona()`.
- **El backend exige una contraseña** y no hay forma de enviársela al vecino. La
  pantalla genera una provisoria legible, la muestra una sola vez y dice que hay
  que entregarla en mano. Ver issues.md, punto 15.

### `/admin/padron/:id` — Legajo ✅
**Permiso** propio o `LEER_TERCEROS` · **Endpoints** `GET /ciudadanos/{id}` · `GET /personas/{id}/domicilios` · `GET /ciudadanos/{id}/relaciones` · `PATCH /ciudadanos/{id}/estado`

Cabecera con nombre, identificadores y estado; cuatro pestañas: datos,
domicilios (con historia), contacto, grupo familiar.

- **Cada bloque se carga por separado** a propósito: si fallan las relaciones, el legajo igual muestra los datos y los domicilios.
- **Acción** cambiar estado, sólo con `CAMBIAR_ESTADO_TITULAR` (o sea, sólo responsable de área). El diálogo ofrece **únicamente** los destinos válidos y advierte cuando el destino es terminal.
- **Pendiente** pestañas de documentos, expedientes y solicitudes del titular.

### `/admin/organizaciones` · `/nueva` · `/:id` ✅
**Endpoints** `GET`/`POST /organizaciones` · `GET`/`PUT /organizaciones/{id}` · `PATCH .../estado` · `GET`/`POST`/`DELETE .../duenos` · `/representaciones`

- **Ojo** `POST /organizaciones` recibe `duenos: [{personaId, porcentajeTitularidad}]`, **no** `personaId[]` (`ARCHITECTURE.md` dice mal esto).
- **Ojo** 409 si la suma de titularidades supera 100, y 409 al quitar el único dueño: la pantalla debería impedir los dos casos antes de enviar.
- **Estados** de organización en femenino (`ACTIVA`), pero una jurídica creada por `/auth/register` usa los masculinos. El badge acepta ambos.

### `/admin/documentacion` ✅
**Endpoints** `GET /personas/{id}/documentos` · `GET /documentos/{id}` · `PATCH /documentos/{id}/validar` · `GET`/`POST /solicitudes-documentacion` · `PATCH .../estado`
Dos bandejas: documentos por validar (`VALIDAR_DOCUMENTACION`, o sea
administrativo para arriba) y solicitudes emitidas con su plazo.
- **Ojo** 409 si el documento ya fue validado · `vigenciaHasta` no puede ser pasada · `plazo` de una solicitud tampoco.

### `/admin/expedientes` · `/nuevo` · `/:id` ✅
**Endpoints** `GET`/`POST /expedientes` · `GET /expedientes/{id}` · `PATCH .../estado` · `GET`/`POST .../actuaciones`

El detalle es **la carátula**, el elemento distintivo del sistema (`DISENO.md`).

- **Ojo** omitir `numero` para que el backend genere `EXP-{año}-{6 dígitos}`.
- **Ojo** 409 al agregar una actuación a un expediente `ARCHIVADO`.
- **Regla del alcance que el backend no valida**: no debería pasar a `RESUELTO` sin al menos una actuación. El front puede prevenirlo con `actuacionesCount === 0`.

### `/admin/consultas` 🚧
**Permiso** `CONSULTA_INTERMODULO` · **Endpoints** los seis `Svc` de `contexto.md` §5.11
Herramienta de consulta puntual: identidad, estado, domicilio principal y
vigencia de representación. Útil para auditoría y para demostrar en la defensa
qué le expone M1 a los otros ocho módulos.

---

## 5. Matriz de pantallas por rol

Lo que decide el menú lateral y las guardas.

| Pantalla | PERSONA | MESA_ENTRADAS | ADMINISTRATIVO | RESP_AREA | AUDITOR |
|---|:--:|:--:|:--:|:--:|:--:|
| Portal completo (lo propio) | ✅ | — | — | — | — |
| Tablero | — | ✅ | ✅ | ✅ | ✅ |
| Padrón (ver) | — | ✅ | ✅ | ✅ | ✅ |
| Alta de vecino | — | ✅ | ✅ | ✅ | — |
| Legajo (ver) | — | ✅ | ✅ | ✅ | ✅ |
| Legajo (editar) | — | ✅ | ✅ | ✅ | — |
| Cambiar estado de titular | — | — | — | ✅ | — |
| Organizaciones (ver/crear) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Representaciones (gestionar) | dueño | — | ✅ | ✅ | — |
| Validar documentación | — | — | ✅ | ✅ | — |
| Pedir documentación | — | ✅ | ✅ | ✅ | — |
| Expedientes (crear, actuar) | — | ✅ | ✅ | ✅ | — |
| Cambiar estado de expediente | — | — | ✅ | ✅ | — |
| Consultas inter-módulo | — | ✅ | ✅ | ✅ | ✅ |

**El auditor ve todo y no escribe nada.** Es el caso que más rápido revela si el
control por rol está bien hecho.

---

## 6. Huecos del backend que el mapa tuvo que sortear

Verificados contra el código, no supuestos.

| # | Hueco | Cómo lo sorteamos | Qué pedir al backend |
|---|---|---|---|
| 1 | **Una persona jurídica no tiene pantalla de perfil.** No existe `PersonaJuridicaController`; `GET /ciudadanos/{id}` resuelve contra `ciudadanoRepository` y le devuelve 404 | El Portal tiene dos variantes; la jurídica no ve "Mis datos" ni "Grupo familiar" | `GET` y `PUT /personas-juridicas/{id}` |
| 2 | **No hay "organizaciones donde soy dueño".** Sólo el listado resumen (sin `duenos`) y los dueños de una organización puntual | "Mis organizaciones" se arma con las representaciones | `GET /personas/{id}/organizaciones` |
| 3 | **Los listados no filtran ni paginan** | `<Tabla>` lo hace del lado del cliente | Si el padrón crece, query params — no hackearlo más en el front |
| 4 | **RF-07 no se puede cumplir entero**: no se puede buscar por domicilio, teléfono ni correo | Se busca por nombre, apellido, DNI y CUIL | Que `GET /ciudadanos` incluya contacto y domicilio, o un endpoint de búsqueda |
| 5 | **Los eventos no se publican ni se consumen** | No hay línea de tiempo consolidada del vecino | Es la segunda entrega |
| 6 | **Ningún cambio de estado acepta `motivo`**, aunque el alcance lo exige (regla 11) | No se pide en la UI | Agregar `motivo` a los `PATCH .../estado` |
| 7 | **La verificación de contactos es simulada** | Se muestra el flujo, sabiendo que cualquier código pasa | Tabla de códigos con vencimiento |
| 8 | **No hay historial de versiones de documentos** | No se ofrece "ver anteriores" | Tabla `documento_version` |
| 9 | **El expediente no tiene estado "esperando documentación"** (el alcance lo llama `PENDING_INFO`) | Se infiere cruzando con las solicitudes pendientes del titular | Definir si se agrega el estado |
| 10 | **No hay listado global de documentos**, sólo `GET /personas/{id}/documentos` | No existe una bandeja general de validación: se valida desde la pestaña Documentos del legajo de cada persona | `GET /documentos?resultado=PENDIENTE` |
| 11 | **No se puede descargar ni ver un archivo subido.** `urlArchivo` es un `file://` del disco del servidor y no hay endpoint de descarga | El archivo no se ofrece como enlace: prometer una descarga que falla es peor que no ofrecerla | `GET /documentos/{id}/archivo` que devuelva el binario |

---

## 7. Trazabilidad contra el enunciado

El checklist de la defensa. Requisitos del enunciado §6.1.

| Requisito | Dónde se cumple | Estado |
|---|---|---|
| Consume sólo la API del módulo | `src/lib/api/` es la única puerta de salida | ✅ |
| Validaciones de formulario | `<Campo>` + validación por pantalla | ✅ |
| Búsquedas | `<Tabla>`, sin acentos | ✅ |
| Filtros | `<Tabla>`, declarativos por pantalla | ✅ |
| Paginación | `<Tabla>`, 25/50/100 | ✅ |
| Estados de carga | `<Cargando>`, `<FilasFantasma>`, y los cuatro estados de `DISENO.md` | ✅ |
| Operaciones según el rol | `permisos.js` + guardas + acciones condicionadas | ✅ |
| Manejo centralizado de errores | `cliente.js` normaliza todo y `mensajeAmable()` traduce | ✅ |
| Autenticación y autorización | JWT en headers, refresh automático, guardas | ✅ |
| **Tablero de indicadores** | `/admin` | ✅ |
| **Cobertura ≥ 85 %** | 361 pruebas · 94 % líneas, 85 % ramas | ✅ |
| **Desplegado** | — | 🚧 |

---

## 8. Por dónde seguir

En este orden, porque cada tanda se apoya en la anterior:

1. ~~**Portal del vecino**: perfil, domicilios, contactos, familia.~~ ✅ Hecho.
2. ~~**Expedientes con la carátula.**~~ ✅ Hecho, en las dos zonas.
3. ~~**Documentación.**~~ ✅ Hecho, incluido el encadenado de subir y cumplir.
4. ~~**Organizaciones y representaciones.**~~ ✅ Hecho, en las dos zonas.
5. ~~**Tablero.**~~ ✅ Hecho. Seis de las ocho métricas previstas; las otras dos
   necesitan endpoints que no existen (ver issues.md, puntos 5 y 14).
