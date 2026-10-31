# Dependencias Java e imagenes Docker

Revision: 31/10/2026. Scanner: Trivy 0.76.1, binario de la release oficial
verificado por SHA-256. Base de vulnerabilidades actualizada al ejecutar. No se
usan ignore-unfixed, filtros de severidad ni .trivyignore para esconder hallazgos.

## Alcance

- Inventario CycloneDX generado por Maven 2.9.3 con includeTestScope=true: versiones
  resueltas de dependencias directas, transitivas y de pruebas.
- Imagenes finales: backend, frontend, Node auxiliar, PostgreSQL y RabbitMQ.
- Etapas de compilacion: Maven/backend y Node/frontend, incluidas sus herramientas.
- Se escanea SO y bibliotecas, se guardan todos los hallazgos y se rechazan altas
  o criticas sin tratamiento documentado. Un fallo del scanner tambien falla CI.
- No equivale a escanear todas las herramientas del host, ni a un pentest de la app.

## Correcciones

| Dependencia | Antes | Despues |
| --- | --- | --- |
| Tomcat | 10.1.55 | 10.1.61 |
| Jackson BOM | 2.21.4 | 2.21.8 |
| RabbitMQ Java client | 5.25.0 | 5.37.0 |
| PostgreSQL JDBC | 42.7.11 | 42.7.14 |
| Log4j API/BOM | 2.24.3 | 2.25.5 |
| Netty (resuelto al actualizar RabbitMQ) | 4.1.135.Final | 4.1.138.Final |

Boot conserva su ultima version 3.5 publicada en Maven Central, 3.5.16. Las
propiedades del BOM mantienen alineados los modulos de cada familia. No se mezcla
Spring Framework 7 con Boot 3 para forzar la desaparicion de una alerta.

En Docker:

- Nginx: actualizacion de paquetes Alpine, incluyendo Brotli y curl afectados.
- Node auxiliar: se retiran npm, Corepack y Yarn; los scripts solo necesitan Node.
- Compilacion frontend: npm 12.2.1, compatible con Node 22.23.4 de la base,
  retiro de Yarn no utilizado y parche Undici 6.29.1 en la copia incluida por npm
  (el npm publicado aun incorpora 6.29.0). Vite 8.3.5 y plugin-react 6.1.2 reemplazan el
  esbuild con Go vulnerable por Rolldown/Oxc. Se vuelve a probar toda la suite.
  Se corrigen dos selectores CSS invalidos de botones de archivo detectados por
  el nuevo minificador, sin desactivar la minificacion ni bajar cobertura.
- PostgreSQL 16: se reemplaza gosu, que incluia Go 1.24.6 vulnerable, por su-exec
  de Alpine. El entrypoint oficial se adapta para invocar su-exec; se conservan
  el usuario, la ruta de datos y la inicializacion original.
- Maven: Guava 33.7.1-jre se sustituye por 33.7.2-jre, con checksum de Maven
  Central. Se elimina el repositorio temporal de dependencias tras compilar.

Las bases siguen fijadas por digest. Las actualizaciones de paquetes del sistema
se resuelven al construir; los JSON registran las versiones y el ID de cada imagen
efectivamente auditada. No se afirma que los digests oficiales originales carezcan
de alertas: se verifican las imagenes derivadas corregidas.

## Dos alertas de Spring: revision de aplicabilidad

El scanner conserva dos CRITICAL sobre spring-webmvc 6.2.19:

- [CVE-2026-47884](https://spring.io/security/cve-2026-47884/): requiere XsltView y
  una ruta amplia que renderice vistas sin nombre explicito. Esta aplicacion no
  configura XSLT ni renderizado de vistas: los controllers son REST y nginx sirve
  React. Conclusion de la revision del codigo: no se cumplen esas precondiciones.
- [CVE-2026-47890](https://spring.io/security/cve-2026-47890/): requiere fragmentos
  de vistas enviados por SSE con datos controlados por otro usuario. No hay SSE
  ni fragmentos de vistas en la API. Conclusion: esa funcionalidad no esta usada.

Son hallazgos presentes en la dependencia, no CVE corregidas. El proveedor publica
la correccion OSS en Framework 7.0.9; 6.2.20 requiere soporte Enterprise. Migrar a
Boot 4/Framework 7 requiere una tarea propia de compatibilidad. Esta revision no
declara arreglada globalmente la version 6.2.19 ni rebaja su severidad en el JSON.

config/sca-excepciones.json limita la revision a esos dos IDs, paquete y version
exactos, y solo al inventario Java y las imagenes que contienen esta aplicacion.
Vence el 30/11/2026: CI falla si no se reevalua. No autoriza CVE nuevas ni otras
versiones. Los reportes crudos conservan las dos alertas y el resumen las distingue
de las altas/criticas sin tratamiento.

ArquitecturaRestSeguraTest analiza el bytecode de la aplicacion y exige controllers
REST, sin dependencias de vistas/resolvers ni emisores SSE. Los tres tests corren
en la suite normal. Son controles contra introducir esas funciones sin revisar;
no reemplazan una revision si se agrega configuracion dinamica o nuevas librerias.

## CI y evidencia

El job Java ejecuta verify, exige cero omisiones, genera el BOM y ejecuta el SCA.
El job Compose prueba login, permisos, broker y persistencia, construye las dos
etapas de compilacion y audita las siete imagenes. El resultado final exige ambos
jobs aprobados. El pipeline mantiene el limite de 14 minutos por etapa.

Artifacts de 14 dias:

- backend-reportes: bom-sca.json y sca/ con JSON, logs y resumen.
- compose-reportes: sca/ con JSON, logs y resumen por imagen.

Para Java, desde la raiz y con Java 21, Maven wrapper, Python 3 y Trivy disponibles:

```text
./mvnw -B -ntp verify
./mvnw -B -ntp org.cyclonedx:cyclonedx-maven-plugin:2.9.3:makeBom -DincludeTestScope=true -DoutputFormat=json -DoutputName=bom-sca
python scripts/auditar-dependencias.py --sbom target/bom-sca.json --report-dir target/sca
```

Las pruebas PostgreSQL requieren las variables M1_TEST_POSTGRES_* documentadas en
CI_TESTING.md. En Windows se usa mvnw.cmd. El script de auditoria admite --trivy
para indicar un binario portable y --cache-dir para guardar las bases localmente.
Los comandos de escaneo de imagenes completos estan en .github/workflows/testing.yml.

Los hallazgos bajos y medios siguen visibles y requieren seguimiento. El verde
acredita este control de dependencias, no el cierre de G6 ni todo el eje D.
