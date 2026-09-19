# Frontend — Módulo 1: Ciudadanos, Organizaciones y Expedientes Digitales

Frontend del Módulo 1 del TPO de Desarrollo de Aplicaciones II (UADE, Grupo 8).
Consume exclusivamente la API del backend del módulo.

**React 18 · Vite · React Router · Tailwind · Radix · Vitest**

---

Vive en `frontend/`, dentro del mismo repositorio que el backend. El backend está
en la raíz.

## Arrancar

```bash
cd frontend
npm install
cp .env.example .env      # y ajustá VITE_API_URL si hace falta
npm run dev               # http://localhost:5173
```

El backend tiene que estar corriendo en `VITE_API_URL` (por defecto
`http://localhost:8080`). Se levanta desde la raíz del repo; ver `INSTALACION.md`
ahí. Necesita PostgreSQL y MongoDB.

```bash
# desde la raíz del repo, con las bases levantadas
./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-Duser.timezone=America/Argentina/Buenos_Aires"
```

> El argumento de la zona horaria no es opcional en Windows con hora de
> Argentina: sin él el backend no arranca. Ver [`issues.md`](issues.md), punto 1.

```bash
npm run build             # compila a dist/
npm run test              # 361 pruebas
npm run test:coverage     # falla si baja del 85 % que exige la cátedra
```

### Usuarios de prueba

Con `db/02_datos_iniciales.sql` cargado en el backend:

| Quién | Ingreso | Clave |
|---|---|---|
| Responsable de área | `admin@municipio.gob.ar` | `Empleado.2026` |
| Mesa de entradas | `mesa@municipio.gob.ar` | `Empleado.2026` |
| Auditor | `auditor@municipio.gob.ar` | `Empleado.2026` |
| Vecino | CUIL `20345678901` | `Ciudadano.2026` |

**No hay usuario semilla con rol `ADMINISTRATIVO`.** Es el único que puede
validar documentación y gestionar representaciones sin ser responsable de área.
Para probar ese escalón hay que insertarlo a mano:

```sql
INSERT INTO cuenta_empleado (mail, nombre_empleado, apellido_empleado, rol, activo)
VALUES ('admin.staff@municipio.gob.ar', 'Elena', 'Ruiz', 'ADMINISTRATIVO', TRUE);

-- El mismo hash BCrypt de "Empleado.2026" que usan los otros tres.
INSERT INTO credencial_empleado (empleado_id, password)
SELECT empleado_id, (SELECT password FROM credencial_empleado LIMIT 1)
FROM cuenta_empleado WHERE mail = 'admin.staff@municipio.gob.ar';
```

### Qué ve cada uno

| Rol | Entra a | Puede |
|---|---|---|
| **Vecino** | Portal | Todo sobre lo propio: datos, domicilios, contacto, familia, organizaciones, documentos y expedientes |
| **Mesa de entradas** | Backoffice | Padrón, alta asistida, legajos, expedientes y actuaciones, pedir documentación |
| **Administrativo** | Backoffice | Lo anterior + validar documentación, cambiar estado de expedientes y gestionar representaciones |
| **Responsable de área** | Backoffice | Todo, incluido bloquear o marcar fallecido a un titular |
| **Auditor** | Backoffice | Ve todo y **no escribe nada** — el mejor rol para comprobar el control de acceso |

---

## Los tres documentos

| | Qué responde |
|---|---|
| [`contexto.md`](contexto.md) | **Cómo hablar con la API.** Los 59 endpoints campo por campo, roles, listas blancas, transiciones y las trampas del backend. Verificado contra el código |
| [`sitemap.md`](sitemap.md) | **Qué pantallas hay.** Rutas, permisos, endpoints y estados de cada una |
| [`DISENO.md`](DISENO.md) | **Cómo se ve y por qué.** Color, tipografía, densidad, movimiento y las reglas que no se negocian |
| [`issues.md`](issues.md) | **Qué está roto o falta en el backend**, cómo lo sorteamos y qué haría falta |

Si vas a escribir una pantalla, leé la ficha que le corresponde en `sitemap.md` y
la sección de componentes de `DISENO.md` antes de empezar.

---

## Cómo está organizado

```
src/
├── lib/
│   ├── api/          cliente HTTP, listas de campos por DTO, endpoints
│   ├── auth/         sesión, tokens, matriz de permisos
│   └── dominio/      estados y transiciones, listas blancas, formato
├── componentes/      Tabla, BadgeEstado, CambiarEstado, Identificador, ui/
├── rutas/            guardas
├── layouts/          público · portal (holgado) · backoffice (compacto)
└── paginas/          publico/ · admin/ · errores/
```

### Tres cosas que conviene saber antes de tocar nada

**1. Los tokens vienen en los headers.** `POST /auth/login` devuelve los datos de
sesión en el cuerpo y el token en `Authorization`, el refresh en
`X-Refresh-Token`. Ya lo resuelve `lib/api/cliente.js`, junto con la renovación
automática ante un 401.

**2. Un campo de más en un cuerpo es un 400.** El backend corre con
`fail-on-unknown-properties`. Toda mutación pasa por `cuerpo("nombreDelDto", datos)`
de `lib/api/campos.js`, que deja pasar sólo los campos declarados. **Nunca
reenvíes a un `PUT` el objeto que te devolvió un `GET`.**

**3. Los listados vienen completos, sin filtrar ni paginar.** Buscar, filtrar,
ordenar y paginar es responsabilidad del front, y lo resuelve `<Tabla>`. Usala en
vez de escribir otra tabla.

---

## Estado

**Portal del vecino** — inicio con el resumen y los avisos de lo que falta, mis
datos, domicilios con historial, contacto con verificación, grupo familiar,
organizaciones, documentos, lo que el municipio le pide, y expedientes.

**Backoffice** — tablero de indicadores; padrón con búsqueda, filtros, orden y
paginación; legajo del vecino con cinco pestañas, cambio de estado y validación
de documentación; organizaciones con dueños y representaciones; solicitudes de
documentación; expedientes con listado, alta y la carátula con sus actuaciones.

**Público** — ingreso (vecino y empleado), registro de persona física o jurídica.

Más toda la base: cliente HTTP con renovación de token, sesión, guardas,
layouts, sistema de diseño y movimiento, y 348 pruebas.

**Todas las pantallas del sitemap están construidas.** Lo único que falta para la
primera entrega es el **despliegue**.

Los problemas del backend que fuimos encontrando están en
[`issues.md`](issues.md), con lo que hace el front mientras tanto.
