# Backend en Render

El repositorio incluye un Dockerfile para compilar Spring Boot con Java 21 y
ejecutarlo como usuario sin privilegios. El contexto de Docker incluye solamente
el POM y las fuentes del backend; excluye configuraciones locales y archivos de
credenciales. Las pruebas se ejecutan antes de publicar cambios, fuera del build
de la imagen.

## Configuración del servicio

Crear un **Web Service** desde el repositorio, con estos valores:

| Campo | Valor |
| --- | --- |
| Branch | `aedelstein` mientras se valida esta integración |
| Language | `Docker` |
| Root Directory | vacío |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | `.` |
| Docker Command | vacío, utiliza el CMD de la imagen |
| Instance Type | `Free` |
| Health Check Path | `/actuator/health` |
| Auto-Deploy | `Off` durante la configuración inicial |

La imagen escucha en `0.0.0.0` y usa el `PORT` que asigna Render, con `10000`
como alternativa. No hace falta instalar Docker en las computadoras del equipo.

## Variables del ambiente

Cargar los valores secretos en **Environment** de Render, fuera del repositorio:

| Variable | Valor |
| --- | --- |
| `POSTGRES_URL` | URL JDBC de PostgreSQL accesible desde Render; por ejemplo `jdbc:postgresql://HOST:5432/BASE?sslmode=require` |
| `POSTGRES_USER` | usuario de esa base |
| `POSTGRES_PASSWORD` | contraseña de esa base |
| `APP_JWT_SECRET` | clave de firma de M1, distinta del secreto de máquina del Core |
| `RABBITMQ_HOST` | `core-uade-2026.duckdns.org` |
| `RABBITMQ_PORT` | `5671` |
| `RABBITMQ_VHOST` | `core` |
| `RABBITMQ_SSL_ENABLED` | `true` |
| `RABBITMQ_USER` | `module_ciudadanos` |
| `RABBITMQ_PASS` | contraseña entregada por Core |
| `APP_EVENTS_QUEUE` | `q.ciudadanos` |
| `RABBITMQ_AUTO_STARTUP` | `false` hasta coordinar el consumidor compartido |

No usar `localhost` para una base que vive en otra computadora. La aplicación
valida las tablas al iniciar: la base debe estar preparada antes del despliegue.
Sobre una base existente, revisar y aplicar `db/03_integracion_m2_m5.sql`; no
ejecutar `retool_schema.sql`, que elimina tablas. Sobre una base nueva, preparar
el esquema con los scripts de alta y verificar los UUID antes de crear las
cuentas de prueba. La configuración no ejecuta estos scripts automáticamente.

`RABBITMQ_AUTO_STARTUP=false` desactiva el listener, pero no desactiva las
publicaciones ni el indicador de salud de RabbitMQ. Para que el health check
general pase, también debe funcionar la conexión al broker. Verificar los
rangos de salida de la región elegida con Core.

M1 utiliza los exchanges y las colas ya creados por Core; no los declara.
Un error `ACCESS_REFUSED - configure access to exchange` indica un intento de
administrar topologia, no una contraseña incorrecta. La version corregida no
expone beans de exchanges, colas ni bindings para que RabbitAdmin los declare.
No hace falta ampliar los permisos de la cuenta para esa declaracion.

## Verificación y pendientes

Después de cargar las variables y preparar la base, usar **Manual Deploy >
Deploy latest commit**. Revisar el log completo del build y del arranque, y
comprobar `GET /actuator/health`. Después probar el login con cuentas de prueba
de ciudadano y empleado, sin utilizar credenciales reales en las capturas.

Para activar el consumo, coordinar una única instancia de `q.ciudadanos`:
varias instancias conectadas reparten los eventos. Detener el consumidor local
antes de habilitar `RABBITMQ_AUTO_STARTUP=true` en Render si usan bases distintas.

El despliegue no registra publicaciones ni cambia schemas del Core.
`updateTicketStatus` es solamente un consumo para M1; no ejecutar registros
genéricos de publicaciones sin revisar la lista con el acuerdo vigente.

El plan gratuito se suspende por inactividad y tiene disco efímero: los archivos
subidos localmente no persisten entre reinicios o despliegues. PostgreSQL conserva
los datos en el proveedor elegido; los documentos persistentes requieren un
almacenamiento externo. Un health check exitoso no acredita la integración de
negocio ni el procesamiento de eventos de punta a punta.

Access y refresh se emiten con HS256 fijado en codigo. Conservar APP_JWT_SECRET
al desplegar: el ambiente actual utiliza Base64 y los pares deben verificar con
los bytes decodificados. Despues de desplegar este ajuste, volver a hacer login
y verificar `alg=HS256` antes de confirmar el contrato operativo con M2/M5. M1
sigue aceptando tokens anteriores firmados con la misma clave hasta que vencen.

Referencias: https://render.com/docs/docker,
https://render.com/docs/web-services y https://render.com/docs/free.
