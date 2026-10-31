# Arranque reproducible de testing (G1)

Requisito: Docker Desktop con motor Linux y Docker Compose funcionando (o Docker
Engine + Compose en Linux). No se necesitan Java, Node, Maven, PostgreSQL ni un
archivo de contrasenas instalado en la maquina. Se necesita acceso a Internet
para las imagenes y dependencias durante la primera compilacion.

Desde un clon de la rama que contenga `compose.yaml`, en la raiz del repositorio:

```sh
docker compose up --build -d --wait --wait-timeout 900
```

Este es el unico comando de arranque. Espera los controles de salud de PostgreSQL,
RabbitMQ, backend y frontend; si algo falla termina con codigo distinto de cero.
El frontend queda en http://localhost:8090 y el health check completo en
http://localhost:8090/api/actuator/health. La API para Postman usa
`http://localhost:8090/api` como baseUrl.

## Cuentas y datos

```sh
docker compose run --rm credenciales
```

Este comando muestra las cuentas sinteticas del entorno y sus claves generadas
al iniciar. No adjuntar esa salida a informes. Incluye dos ciudadanos y empleados
responsable, mesa y auditor. La base recibe `01_schema.sql`, la migracion
`03_integracion_m2_m5.sql` y un seed exclusivo de testing. Las contrasenas se
hashean con BCrypt; no se reutilizan los hashes publicos del seed historico.

La inicializacion SQL ocurre en un volumen PostgreSQL nuevo, antes del arranque
definitivo de la base. Hibernate mantiene `ddl-auto=validate`. Volver a arrancar
conserva la base y las claves; no vuelve a cargar el esquema ni borra datos. Los
futuros cambios de esquema deben tener su migracion correspondiente.

## Comprobacion automatizada y persistencia

```sh
docker compose run --rm verificar
```

Comprueba HTML/SPA, health de la aplicacion, login real de ciudadano y empleado,
preservacion del header JWT por el proxy, permisos 401/403/200, creacion de un
contacto sintetico y consumidor conectado a RabbitMQ. Los resultados no imprimen
tokens ni contrasenas. No reemplaza la suite completa del TPO.

Para verificar que el contacto y las credenciales sobreviven a recrear contenedores:

```sh
docker compose down
docker compose up --build -d --wait --wait-timeout 900
docker compose run --rm -e EXIGIR_PERSISTENCIA=true verificar
```

`down` conserva los volumenes de base, broker, documentos y configuracion privada.
`docker compose down -v` elimina TODOS los datos de este entorno; usarlo unicamente
cuando se quiera empezar una prueba vacia. No borrar solo el volumen de claves:
la base y el broker existentes seguirian esperando las claves anteriores.

## Mensajeria local y alcance de los simuladores

RabbitMQ Management: http://localhost:15673. Las credenciales estan en la salida
de `credenciales`, usuario `ciudadanos` y vhost `core`.

- `muni.inbox` recibe las publicaciones reales de M1; `q.core.testing` las conserva
  para inspeccion, como sustituto local de la recepcion del Core.
- Publicar un sobre JSON del contrato en `testing.entrantes`, routing key
  `ciudadanos`, lo entrega a `q.ciudadanos`, consumida por M1.
- Los mensajes rechazados van a `testing.dlx` y `q.ciudadanos.dlq`.
- Las colas y exchanges se provisionan al arrancar el broker; M1 conserva su
  configuracion de no declarar la topologia administrada por Core.

El codigo actual no tiene clientes SOAP/REST salientes. Por eso este arranque no
agrega servicios HTTP desconectados para aparentar una integracion. Las pruebas
reales de contratos, ruteo y resiliencia con M2/M5/Core son trabajo separado.
Si las HU comprometidas agregan clientes SOAP/REST, incorporar sus mocks y sus
contratos al Compose antes de dar por cerrado todo el alcance de G1.

## Aislamiento y operacion

El proyecto Docker se llama `ciudadanos-testing`. No conecta con Retool, Render ni
el broker compartido. No importa `application-local.yml`, `.env.render` ni los
archivos `.env` del frontend a las imagenes. Las claves se generan en el volumen
privado `configuracion`; los Dockerfiles no contienen secretos. Los puertos de
PostgreSQL y AMQP no se publican en el host; web y Management escuchan solo en
127.0.0.1. Las cuentas y el broker de este entorno son para desarrollo/testing.

Para usar otros puertos, definir `TESTING_WEB_PORT` y `TESTING_RABBIT_UI_PORT`
antes de arrancar. Sus valores por defecto son 8090 y 15673.

```sh
docker compose ps
docker compose logs --tail=80 backend
docker compose stop
docker compose start
```

El limite de 15 minutos debe medirse desde el comando de arranque hasta todos
los servicios saludables en una maquina de prueba. La primera descarga y la
velocidad de Internet afectan el tiempo; registrar el resultado real.
