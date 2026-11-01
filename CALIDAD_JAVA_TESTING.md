# Calidad Java: alcance y reproduccion

Actualizado el 01/11/2026. Meta interna 03/11; testing oficial 10/11 antes de 13:30.
Ver EVIDENCIA_CALIDAD_JAVA_2026-11-01.md y REVISION_SONAR_JAVA.md. Esto no cierra todos los G ni sustituye las HU de Trello.

## Alcance y gates

Se conservan las 14 clases superiores de servicios de contacto, documentacion, domicilio, persona (incluido Directorio), organizacion, expediente e intermodulo, mas TransicionesEstado, ListasBlancas y AutorizacionService. No se retiraron clases poco cubiertas.
DTO/entidades sin reglas, repositorios, controllers, archivos, eventos, autenticacion y JWT siguen en la suite y el analisis global, pero no en ese porcentaje de negocio. Sus requisitos propios de seguridad/resiliencia siguen vigentes.

JaCoCo 80% lineas / 70% ramas, PMD y PIT 60% se ejecutan en **verify por defecto**, tambien en Testing G3. scripts/medir-dominio.py comprueba que los alcances JaCoCo/PIT coincidan, no esten vacios y cumplan los minimos. No se bajaron umbrales ni operadores de mutacion.

## Java local (PowerShell 7, Java 21, Docker)

```powershell
docker build -f docker/testing/postgres.Dockerfile -t ciudadanos-testing-postgres docker/testing
./scripts/probar-java-local.ps1
python scripts/medir-dominio.py --exigir
```

El helper crea PostgreSQL con puerto/password temporales, ejecuta verify incluidos los gates, comprueba cero omisiones, elimina solo su contenedor temporal y restaura variables del proceso. Respeta JAVA_HOME. No usa Retool/Render/Core ni borra volumenes de la demo.
Log: target/maven-testing.log. Reportes: target/surefire-reports, target/site/jacoco, target/dominio-cobertura.json y target/pit-reports. Copiarlos antes de otra corrida.

Para diagnosticar solo PIT:

```powershell
./scripts/probar-java-local.ps1 -MavenArguments @('test-compile','org.pitest:pitest-maven:mutationCoverage')
```

No acreditar una medicion completa sin PostgreSQL: sus tests detectan mutantes de TramitesExternos. Los timeouts se informan separados de KILLED.

## SonarQube local reproducible

No necesita cuenta externa. compose.sonar.yaml usa imagen oficial 26.10.0.133078 fijada por digest, puerto 29000 solo en localhost y volumenes propios. H2 sirve para evaluacion local, no produccion. No usar down -v.

```powershell
docker compose -f compose.sonar.yaml up -d
# Esperar a que http://127.0.0.1:29000/api/system/status informe UP.
./scripts/probar-java-local.ps1
./scripts/probar-sonar-local.ps1
```

El helper rota la clave inicial del administrador y guarda la credencial cifrada con DPAPI de Windows en target/sonar-auth/admin.clixml, fuera de git y los artefactos. Genera un token de scanner y lo revoca al terminar; no imprime claves. Conservar el archivo cifrado mientras se conserve la instancia: mvn clean lo elimina y la clave ya no sera la inicial. No se usa clean en este flujo. Solo permite administrar localhost/127.0.0.1.

Una instancia nueva puede fallar en el primer analisis por S4502. Leer REVISION_SONAR_JAVA.md y revisar el contrato de autenticacion y las pruebas antes de ejecutar esta accion explicita:

```powershell
./scripts/probar-sonar-local.ps1 -RevisarCsrf
./scripts/probar-sonar-local.ps1
./scripts/probar-sonar-local.ps1 -Consultar
```

La revision solo afecta S4502 de SecurityConfig en la instancia local, exige las dos pruebas SeguridadHttpTest aprobadas sin omisiones y posteriores al codigo. No desactiva reglas ni acepta otros hallazgos. Si se agrega autenticacion por cookie, sesion o Basic, reabrir la revision.

El helper copia Sonar way y agrega condiciones de **codigo completo**: bugs=0, vulnerabilidades abiertas=0, Blocker=0, Critical=0 y duplicacion<=3%. Conserva 80% de cobertura nueva y 3% de duplicacion nueva; desactiva la excepcion automatica para cambios pequenos. No se acepta el verde inicial con conditions vacias. Espera al gate y falla si no aprueba. JSON y scanner.log quedan en target/sonar-local-evidencia. La cobertura global Sonar no equivale a la de dominio.

## CI y Sonar remoto

Testing G3 ejecuta ahora JaCoCo/PIT automaticamente y conserva reportes. Cada job mantiene el limite de 14 minutos. Calidad de dominio Java permite una ejecucion manual equivalente. No inferir tiempos de GitHub a partir del entorno local.

El workflow manual Sonar - Quality Gate Java queda preparado para SonarCloud: PostgreSQL, verify, JaCoCo y espera de gate de 300 s. Requiere secret SONAR_TOKEN y variables SONAR_HOST_URL, SONAR_PROJECT_KEY, SONAR_ORGANIZATION en GitHub Actions, proyecto con analisis CI habilitado y gate equivalente asignado. No pegar tokens en el chat. Revisar CSRF en ese proyecto con evidencia, sin copiar resoluciones a ciegas.
No se creo ni modifico una cuenta SonarCloud ni se acredita su ejecucion remota. El Sonar ejecutado es local y cubre Java, no frontend.

Fuentes: [PIT Maven](https://pitest.org/quickstart/maven/), [SonarScanner Maven](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/scanners/sonarscanner-for-maven/) y [Docker oficial SonarSource](https://github.com/SonarSource/docker-sonarqube/blob/master/examples.md).

## Limites funcionales pendientes

- ContactoService.verificar no compara el codigo con uno emitido; no se acredita verificacion real email/SMS.
- El patron de telefono y su mensaje de longitud no expresan exactamente la misma regla.
- Solicitudes puede cumplir estado aunque falle la publicacion; no se acredita outbox atomico o entrega garantizada.
- Transiciones invalidas devuelven 400; continuidad exige acreditar 409.
- Expedientes numera contando filas; no acredita numeracion concurrente segura.
- CORS exige origen exacto: frontend en otro origen requiere APP_CORS_ALLOWED_ORIGINS. No se desplego produccion.

Contrastar con HU/contratos y registrar en Trello. IA genero tests, configuracion y correcciones; siguen pendientes la revision humana y la defensa individual.
