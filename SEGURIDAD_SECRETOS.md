# Configuracion privada y auditoria de secretos

## Arranque local

El backend importa `application-local.yml` desde el directorio de trabajo (la raiz
del proyecto en IntelliJ y Maven). Git ignora ese archivo. No copiarlo a Teams,
no adjuntarlo a reportes y no forzar su inclusion con `git add -f`.

Se puede configurar mediante variables de entorno (ver `.env.example`) o crear
el archivo local con esta estructura, reemplazando los marcadores:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://HOST/BASE?sslmode=require
    username: USUARIO
    password: CONTRASENA_PRIVADA
app:
  jwt:
    secret: CLAVE_BASE64_PRIVADA_DE_AL_MENOS_32_BYTES
```

Generar una clave JWT aleatoria propia, no reutilizar los ejemplos de los tests.
Las variables de entorno tienen prioridad sobre el archivo local. Spring no lee
`.env` automaticamente. `POSTGRES_PASSWORD` y `APP_JWT_SECRET` ya no tienen un
secreto por defecto. RabbitMQ conserva `guest/guest` solo para desarrollo local.

La configuracion privada de esta maquina conserva la conexion existente y usa
una clave JWT local nueva. En el siguiente reinicio sera necesario iniciar sesion
otra vez: los tokens anteriores no serviran en esta instancia.

Los ejemplos de login ahora usan `{{empleadoPassword}}`. En Postman/Insomnia
definirla como variable privada. En Bruno se obtiene de `EMPLEADO_PASSWORD`.
Los hashes de los usuarios de demostracion en `db/02_datos_iniciales.sql` y
`db/retool_schema.sql` son fixtures publicos: no acreditan credenciales seguras
para una base compartida. No se cambiaron contrasenas de cuentas en remoto.

## Auditoria reproducible

Instalar el binario de Gitleaks desde https://github.com/gitleaks/gitleaks.
Ejecutar desde PowerShell:

```powershell
./scripts/auditar-secretos.ps1 -Gitleaks 'C:/ruta/gitleaks.exe'
```

El script escanea archivos que Git permite versionar, incluidos cambios pendientes,
y todo el historial alcanzable de las referencias locales (`--all --full-history`).
Desactiva textconv para evitar ejecutar conversores de documentos durante el diff.
No equivale a revisar refs que aun no se hayan descargado del servidor.
Antes del escaneo de entrega, traer explicitamente todas las ramas: un clon
puede tener un refspec restringido y `git fetch --all` no lo amplifica.

```powershell
git fetch origin '+refs/heads/*:refs/remotes/origin/*' --tags
```

Usa las reglas estandar mas deteccion del password del proveedor y de claves JWT
embebidas. No hay exclusiones de hallazgos conocidos ni baseline que los oculte.
Los archivos Bruno `.bru` se copian temporalmente con sufijo `.txt`, porque el
escaneo de directorios de Gitleaks omite esa extension; el informe conserva ese
sufijo para identificar la copia examinada. Se verifico el detector con dos JWT
reales previamente expuestos, sin imprimirlos.
Los reportes JSON y logs se redactan y se guardan fuera del repositorio por defecto.
Salida 1 indica hallazgos; un error interno tambien impide dar el escaneo por limpio.

## G6 sigue pendiente mientras el historial tenga secretos

Quitar un secreto del archivo actual no lo elimina de commits anteriores ni lo
revoca. Antes de presentar:

1. Rotar en Retool la credencial de base expuesta y actualizar las configuraciones
   privadas de todos los consumidores. Rotar las claves JWT de instancias compartidas.
   Revisar tambien las cuentas de demostracion si se usan en remoto.
2. Coordinar una ventana con el equipo y conservar una copia privada del repositorio.
3. Reescribir todas las ramas y tags afectados con git-filter-repo o equivalente.
   La lista de ubicaciones afectadas esta en el reporte redactado; no usar ese
   reporte como archivo de reemplazos porque no contiene los valores originales.
4. Volver a escanear, publicar el historial corregido coordinadamente y pedir a todos
   que clonen otra vez para no reintroducir los commits anteriores. Atender forks,
   PRs y referencias conservadas por el servidor segun corresponda.
5. Escanear un clon nuevo del remoto antes de crear el tag de testing.

El 30/10 se actualizo la copia aislada del remoto completo con sus siete ramas,
incluyendo los cambios de Docker/Render, RabbitMQ de Core y HS256 explicito.
El historial original tiene 16 hallazgos del scanner; la copia saneada tiene cero.
Se verifico el contenido de sus 40 commits: mismas rutas y modos, solo reemplazos
previstos. La publicacion autorizada usa leases por rama para rechazar cambios
concurrentes; no usar el paquete anterior del 28/10.

La limpieza del Git no revoca credenciales ni cambia variables en Render/Retool.
Las referencias de PR y caches de GitHub pueden conservar commits originales y
requieren tratamiento separado. G6 no se acredita solo con un escaneo local:
adjuntar el escaneo de un espejo nuevo del remoto y registrar esos pendientes.
