# Instalación — qué necesitás para correr la API y la base

Guía para dejar el proyecto andando desde cero en una máquina nueva.
Al final hay una [verificación completa](#7-verificación-de-punta-a-punta) para confirmar que quedó bien.

---

## 1. Qué hay que instalar

| Software | Versión | Para qué | ¿Obligatorio? |
|---|---|---|---|
| **JDK** | **21 o superior** | compilar y correr la API | Sí |
| **PostgreSQL** | **14 o superior** | datos transaccionales | Sí |
| **MongoDB** | **6 o superior** | outbox de eventos | Sí |
| `mongosh` | acompaña a MongoDB | crear las colecciones | Sí |
| Git | cualquiera | clonar el repo | Sí |
| Maven | — | **NO hace falta**: el repo trae `./mvnw` | No |

> **Maven no se instala.** El proyecto incluye el Maven Wrapper (`mvnw`, `mvnw.cmd`,
> `.mvn/`), que baja la versión correcta de Maven la primera vez que lo corrés.

### Verificar qué tenés

```bash
java -version      # necesitás 21+
psql --version     # necesitás 14+
mongosh --version  # necesitás 6+
git --version
```

---

## 2. Instalar en tu sistema operativo

### Linux (Debian / Ubuntu)

```bash
sudo apt update
sudo apt install -y openjdk-21-jdk postgresql postgresql-client git

# MongoDB no está en los repos de Debian/Ubuntu: hay que agregar el de Mongo
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
  | sudo gpg -o /usr/share/keyrings/mongodb.gpg --dearmor
echo "deb [signed-by=/usr/share/keyrings/mongodb.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt update && sudo apt install -y mongodb-org

# Arrancar los servicios
sudo systemctl enable --now postgresql mongod
```

### macOS (Homebrew)

```bash
brew install openjdk@21 postgresql@16 git
brew tap mongodb/brew && brew install mongodb-community@8.0

brew services start postgresql@16
brew services start mongodb-community@8.0

# Homebrew no linkea el JDK solo:
sudo ln -sfn "$(brew --prefix)/opt/openjdk@21/libexec/openjdk.jdk" \
             /Library/Java/JavaVirtualMachines/openjdk-21.jdk
```

### Windows

1. **JDK 21** — [Adoptium Temurin 21](https://adoptium.net/temurin/releases/?version=21).
   Durante la instalación tildá *"Set JAVA_HOME variable"*.
2. **PostgreSQL** — [instalador oficial](https://www.postgresql.org/download/windows/).
   Anotá la contraseña que le ponés al usuario `postgres`; la vas a necesitar en el paso 4.
   Tildá *"Add PostgreSQL to PATH"* para poder usar `psql` desde la terminal.
3. **MongoDB Community + mongosh** — [instalador oficial](https://www.mongodb.com/try/download/community).
   Tildá *"Install MongoDB as a Service"* y también instalá **MongoDB Shell (mongosh)**.
4. **Git** — [git-scm.com](https://git-scm.com/download/win).

Usá **Git Bash** o **PowerShell** para los comandos que siguen. En PowerShell,
`./mvnw` se escribe `.\mvnw.cmd`.

### Alternativa: Docker para las bases

Si preferís no instalar PostgreSQL y MongoDB en la máquina, alcanza con Docker
(igual necesitás el JDK 21 para la API):

```bash
docker run -d --name ciudadanos-pg \
  -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

docker run -d --name ciudadanos-mongo \
  -p 27017:27017 mongo:8
```

Después seguís desde el paso 4 igual, pero corriendo `psql` y `mongosh` dentro
del contenedor (`docker exec -i ciudadanos-pg psql ...`).

---

## 3. Clonar el proyecto

```bash
git clone <URL-DEL-REPO>
cd Ciudadanos-Modulo1-backend
```

---

## 4. Crear la base de PostgreSQL

Los tres scripts están en `db/` y hay que correrlos **en orden**.

```bash
# 1. Base de datos y rol de la aplicación (como superusuario, desde OTRA base)
psql -U postgres -f db/00_crear_database.sql

# 2. Tablas, restricciones e índices
psql -U postgres -d ciudadanos_m1 -f db/01_schema.sql

# 3. Datos de prueba — OPCIONAL, solo para desarrollo
psql -U postgres -d ciudadanos_m1 -f db/02_datos_iniciales.sql
```

En **Windows** con el instalador oficial, si `psql` no está en el PATH:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f db\00_crear_database.sql
```

> `00_crear_database.sql` arranca con `DROP DATABASE IF EXISTS ciudadanos_m1`.
> **Borra la base si ya existía.** Para reinstalar sin perder datos, saltealo y
> corré solo el `01_schema.sql` sobre una base creada a mano.

### Si el locale falla

`00_crear_database.sql` pide `es_AR.UTF-8`. Si tu sistema no lo tiene, el script
falla con `invalid locale name`. Editá el archivo y reemplazá estas dos líneas:

```sql
LC_COLLATE = 'es_AR.UTF-8'
LC_CTYPE = 'es_AR.UTF-8'
```

por:

```sql
LC_COLLATE = 'C'
LC_CTYPE = 'C'
```

---

## 5. Crear las colecciones de MongoDB

```bash
mongosh "mongodb://localhost:27017" --file db/mongodb_setup.txt
```

Tiene que imprimir:

```
Colecciones: evento_outbox, evento_procesado
```

---

## 6. Configurar y levantar la API

### Variables de entorno

Todas tienen un valor por defecto pensado para desarrollo local, así que **para
probar en tu máquina no hace falta configurar nada**. Para cualquier otro entorno
son obligatorias.

| Variable | Default | Qué es |
|---|---|---|
| `POSTGRES_URL` | `jdbc:postgresql://localhost:5432/ciudadanos_m1` | conexión JDBC |
| `POSTGRES_USER` | `ciudadanos_app` | usuario de la base |
| `POSTGRES_PASSWORD` | `cambiar_en_local` | contraseña |
| `MONGO_URI` | `mongodb://localhost:27017/ciudadanos_m1_eventos` | conexión Mongo |
| `APP_JWT_SECRET` | clave de desarrollo | firma HS256 — **mínimo 32 bytes** |
| `ALMACENAMIENTO_DIR` | `./archivos-documentos` | dónde se guardan los archivos subidos |
| `SERVER_PORT` | `8080` | puerto HTTP |

Generar un secreto real:

```bash
openssl rand -base64 48
```

Definirlas (Linux/macOS):

```bash
export POSTGRES_PASSWORD='la-que-pusiste'
export APP_JWT_SECRET='el-que-generaste'
```

En PowerShell:

```powershell
$env:POSTGRES_PASSWORD = 'la-que-pusiste'
$env:APP_JWT_SECRET    = 'el-que-generaste'
```

### Levantar

```bash
./mvnw spring-boot:run       # Linux / macOS
.\mvnw.cmd spring-boot:run   # Windows PowerShell
```

La primera vez tarda unos minutos: baja Maven y todas las dependencias.

### Correr los tests

```bash
./mvnw test
```

Son 51 y **no necesitan las bases de datos** — si fallan, el problema es el
código, no tu instalación.

### Generar el `.jar`

```bash
./mvnw package
java -jar target/ciudadanos-modulo1-0.0.1-SNAPSHOT.jar
```

---

## 7. Verificación de punta a punta

```bash
# 1. La API está viva
curl localhost:8080/actuator/health
# -> {"status":"UP"}

# 2. Registrar un ciudadano
curl -i -X POST localhost:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"tipo":"CIUDADANO","cuit":"20-40123456-7","password":"clave-segura-1",
       "dni":"40123456","nombre":"Ana","apellido":"Perez","fechaNacimiento":"1997-03-08"}'
# -> 201 con el personaId

# 3. Login: el token viene en el header Authorization, no en el cuerpo
curl -i -X POST localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"cuit":"20401234567","password":"clave-segura-1"}'

# 4. Usar el token (reemplazá <TOKEN> por lo que salió en Authorization)
curl localhost:8080/ciudadanos/1 -H 'Authorization: Bearer <TOKEN>'
```

Si los cuatro pasos funcionan, la instalación está completa.

---

## 8. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `Schema-validation: missing table [persona]` | no corriste `01_schema.sql` | volvé al paso 4 |
| `Schema-validation: wrong column type` | el esquema quedó de una versión anterior | recreá la base con los scripts del paso 4 |
| `FATAL: password authentication failed` | `POSTGRES_PASSWORD` no coincide | exportá la contraseña real del paso 4 |
| `Connection refused: localhost:5432` | Postgres no está corriendo | `sudo systemctl start postgresql` |
| `Timed out ... localhost:27017` | Mongo no está corriendo | `sudo systemctl start mongod` |
| `app.jwt.secret debe tener al menos 256 bits` | `APP_JWT_SECRET` muy corto | generá uno con `openssl rand -base64 48` |
| `release version 21 not supported` | JDK viejo | instalá el JDK 21 y revisá `JAVA_HOME` |
| `Port 8080 was already in use` | otro proceso en el 8080 | `export SERVER_PORT=8081` |
| `Permission denied: ./mvnw` | falta el bit de ejecución | `chmod +x mvnw` |

### Para reinstalar desde cero

```bash
psql -U postgres -f db/00_crear_database.sql   # recrea la base (borra la anterior)
psql -U postgres -d ciudadanos_m1 -f db/01_schema.sql
mongosh "mongodb://localhost:27017" --eval 'db.getSiblingDB("ciudadanos_m1_eventos").dropDatabase()'
mongosh "mongodb://localhost:27017" --file db/mongodb_setup.txt
./mvnw clean package
```
