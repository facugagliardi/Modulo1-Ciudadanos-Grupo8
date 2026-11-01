# Calidad Java: alcance y reproduccion

Actualizado el 01/11/2026. Meta interna: 03/11; testing oficial: 10/11 antes de 13:30.
Este documento no acredita el cierre de G3/G4 ni reemplaza las HU de Trello.

## Alcance de negocio

Se miden las 14 clases superiores de servicios de contacto, documentacion,
domicilio, persona (incluido CiudadanoDirectorioService), organizacion,
expediente e intermodulo, mas TransicionesEstado, ListasBlancas y
AutorizacionService. Incluye servicios con baja cobertura. No existe un paquete
unico de dominio. Se excluyen de esta metrica DTO/entidades sin reglas,
repositorios, controllers, almacenamiento y adaptadores de eventos, autenticacion
y JWT. Estos siguen en la suite y reporte global, pero necesitan tambien sus
propias pruebas de seguridad/integracion. No se usa cobertura global como dominio.

`pom.xml` declara las selecciones JaCoCo/PIT y los minimos: 80% lineas, 70% ramas,
60% mutacion. `scripts/medir-dominio.py` verifica que ambos alcances coincidan y
que seleccionen clases, genera `target/dominio-cobertura.json` y con `--exigir`
falla si no se alcanzan los porcentajes. Los umbrales no se redujeron.

## Ejecucion local (PowerShell 7, Java 21, Docker)

Preparar una vez la imagen aislada si falta:

```powershell
docker build -f docker/testing/postgres.Dockerfile -t ciudadanos-testing-postgres docker/testing
```

El helper versionado crea un contenedor con puerto y password temporales y lo
elimina al terminar, incluso ante fallo. No borra volumenes de la demo ni usa
Retool/Render/Core. Respeta JAVA_HOME si esta definido.

```powershell
./scripts/probar-java-local.ps1
python scripts/medir-dominio.py --exigir
./mvnw.cmd -B -ntp -Pcalidad-dominio jacoco:check@minimos-dominio
./scripts/probar-java-local.ps1 -MavenArguments @('test-compile','org.pitest:pitest-maven:mutationCoverage')
```

El helper comprueba cero omisiones despues de `verify`. Si PIT queda por debajo
del 60%, Maven falla y los reportes permanecen en `target/pit-reports`. Su log
esta en `target/maven-testing.log`; copiarlo antes de otra corrida.
No usar una corrida PIT sin variables PostgreSQL como medicion completa: las
pruebas reales de TramitesExternos aportan cobertura y deteccion de mutantes.

## CI y Sonar

`Testing G3` conserva su flujo automatico. El nuevo workflow manual
`Calidad de dominio Java` ejecuta dos controles independientes (cobertura/PIT),
con PostgreSQL y timeout de 14 minutos por job; conserva artefactos aunque fallen.
No son todavia controles obligatorios de merge/tag. Sus resultados esperados
actuales son rojos hasta cerrar la deuda, sin `continue-on-error`.
El tiempo medido localmente no acredita la duracion en runners de GitHub.

El workflow manual `Sonar - Quality Gate Java` prepara PostgreSQL, ejecuta
verify y analisis Maven, importa JaCoCo y espera hasta 300 s al Quality Gate.
Requiere configurar en GitHub Settings > Secrets and variables > Actions:

- Secret `SONAR_TOKEN` con permiso de analisis del proyecto (no pegarlo en chats).
- Variables `SONAR_HOST_URL`, `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` de SonarCloud.
- Importar/crear el proyecto en la organizacion correcta y habilitar analisis CI
  segun la configuracion de esa cuenta. Revisar el Quality Gate asignado.

No se creo una cuenta ni se envio codigo a Sonar. No se pudo consultar la
configuracion remota con `gh` porque ese comando no esta instalado. Por tanto,
no se afirma que falten los secretos ni que ya existan. Gestion puntual pendiente:
comprobar esos cuatro valores en el repo/proyecto y ejecutar el workflow; luego
revisar hallazgos y asociar los controles al cierre final. Este analisis solo
cubre Java; no acredita analisis Sonar del frontend.

Fuentes de configuracion:
[PIT Maven](https://pitest.org/quickstart/maven/) y
[SonarScanner Maven](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/scanners/sonarscanner-for-maven/).

## Limites funcionales observados

- ContactoService.verificar no comprueba el codigo recibido contra uno emitido.
  Los tests del cambio de estado no acreditan verificacion real de email/SMS.
- La expresion de telefono y su mensaje de longitud no representan exactamente
  la misma restriccion; revisar criterios antes de fijar limites funcionales.
- SolicitudDocumentacionService captura errores de publicacion y puede completar
  la solicitud igualmente. Hay una prueba de caracterizacion de ese camino:
  no acredita entrega del evento, outbox atomico ni reproceso. El publicador
  tiene persistencia propia, pero no se demostro atomicidad extremo a extremo.
- Las transiciones invalidas actuales producen 400, mientras continuidad exige
  probar 409. No se cambio esa regla para conseguir tests verdes.
- ExpedienteService genera numero contando filas; no se acredita numeracion
  concurrente segura ni respuesta 409 para toda colision de persistencia.

Estas observaciones deben contrastarse con HU/contratos, registrarse en el tablero
y resolverse antes de afirmar aceptacion funcional. La IA genero tests y
configuracion; la revision humana y defensa individual siguen pendientes.
