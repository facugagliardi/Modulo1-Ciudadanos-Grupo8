# Integracion continua para G3

Workflow: `.github/workflows/testing.yml`, nombre **Testing G3**.
Se ejecuta al subir una rama, en pull requests, al crear `v1.0-testing` y por
ejecucion manual cuando el workflow este disponible en la rama por defecto.
Las acciones estan fijadas por SHA. No necesita secretos de Retool, Render ni Core.
Permiso del token: solo lectura del contenido del repositorio.

## Etapas y condiciones

| Etapa | Que ejecuta | Que hace fallar el job |
|---|---|---|
| Java | JDK 21, PostgreSQL real efimero, Maven verify, JaCoCo, PMD, BOM y Trivy | Build, test fallido/omitido, PMD o alerta SCA alta/critica sin tratamiento |
| React | Node 22, npm ci, ESLint 10, Vitest con cobertura, npm audit, Vite build | Error de lint/build, test fallido/omitido, umbral de cobertura incumplido o alerta alta/critica en npm audit |
| Compose | Sistema completo, verificacion HTTP, persistencia y Trivy sobre siete imagenes | Arranque, login, permisos, proxy, consumidor, persistencia o alerta SCA alta/critica sin tratamiento |
| Secretos | Gitleaks 8.30.1, archivos actuales e historial disponible, incluidos Bruno | Hallazgo o fallo interno del escaneo |
| Resultado G3 | Resume y exige las cuatro etapas | Cualquier etapa fallida, cancelada u omitida |

Los jobs corren en paralelo y tienen limites de tiempo. No hay continue-on-error
ni una baseline que oculte hallazgos. La revision acotada de dos CVE de Spring
conserva las alertas en el JSON y exige controles de arquitectura; tiene version,
ambito y vencimiento explicitos. Los reportes se conservan 14 dias como artifacts
del run: JUnit, cobertura, PMD, BOM, SCA, logs de Compose y escaneo redactado.
No se publican cuentas de prueba, volumenes privados ni variables de despliegue.

Las 11 pruebas de `TramitesExternosPostgresTest` se habilitan expresamente con
`M1_TEST_POSTGRES_URL`, `M1_TEST_POSTGRES_USER` y `M1_TEST_POSTGRES_PASSWORD`.
El runner genera una clave aleatoria, la enmascara y usa una instancia PostgreSQL
exclusiva. Nunca se utiliza `application-local.yml` para esos tests.

El job Java también inicia RabbitMQ aislado y define `M1_TEST_RABBIT_PORT` para
comprobar confirms y returns del outbox sin omitir esa prueba. El flujo M8 completo
se ejecuta en Surefire con Hibernate y un schema aleatorio; se excluye de PIT para
no levantar todo Spring por cada mutante. Sus servicios conservan pruebas unitarias
en la ejecución de mutaciones.

PMD aplica las reglas de defectos declaradas en `config/pmd.xml` a fuentes y tests.
ESLint aplica las reglas recomendadas de JavaScript, con soporte JSX nativo y
globales de Vitest solamente en los tests. Se eliminan imports sin uso en vez
de desactivar la regla.
El entorno de tests usa `America/Argentina/Buenos_Aires`: las aserciones de
fechas del portal verifican esa zona, independientemente del sistema del runner.
Esto no modifica la zona horaria del navegador ni la del backend de produccion.

## Repetir los controles localmente

```sh
./mvnw verify
cd frontend
npm ci
npm run lint
npm run test:coverage
npm run build
```

Maven sin `M1_TEST_POSTGRES_URL` omite las pruebas PostgreSQL opt-in. Para reproducir
TODO el job Java, apuntar esa variable a una base de prueba exclusiva y definir
usuario/password; no utilizar la base compartida. El workflow comprueba que el
total omitido sea cero. La prueba crea y elimina su propio schema aleatorio.

La verificacion integral usa los comandos documentados en `TESTING_LOCAL.md`.
El script de secretos funciona con el ejecutable Gitleaks y produce solo reportes
redactados; el workflow verifica tambien el checksum de la descarga.

## Como cerrar G3 para la entrega

1. Integrar los cambios definitivos en main mediante revision del equipo.
2. Ejecutar el workflow y resolver sus fallos sin omitir pruebas ni controles.
3. Crear `v1.0-testing` en un commit de main, antes del horario exigido.
4. Verificar el run disparado por ese tag. El workflow rechaza un tag cuyo commit
   no este integrado en main.
5. Entregar el enlace del run aprobado sobre el tag y sus artifacts.

Un run verde en aedelstein es una verificacion previa; no reemplaza el run del tag.

## Limites: no equivale a cerrar todos los ejes del TPO

- El Quality Gate de SonarQube/SonarCloud (ratings, hotspots, vulnerabilidades y
  duplicacion) sigue pendiente de configuracion. PMD/ESLint no acreditan ese gate.
- JaCoCo publica cobertura; la comprobacion de los umbrales de dominio y PIT para
  mutation score se completan en el trabajo del eje B. No se declaran alcanzados.
- La verificacion HTTP de Compose no equivale a los cinco escenarios E2E de
  navegador ni a contratos completos OpenAPI/WSDL.
- Los tests actuales de integracion y el consumidor conectado al broker no
  acreditan por si solos toda la resiliencia exigida por la catedra.
- El escaneo de Git revisa las referencias disponibles en el checkout. La purga
  de las referencias PR antiguas de GitHub sigue su tramite de Support por G6.
- npm audit incluye dependencias de desarrollo y falla con severidad alta o
  critica. Su JSON queda en el artifact frontend-reportes. Las moderadas siguen
  registradas para tratamiento. Java y siete imagenes tienen un SCA adicional
  con Trivy y reportes completos; ver SCA_JAVA_DOCKER.md. Dos alertas de Spring
  tienen revision de aplicabilidad acotada y controles de arquitectura. El gate
  no declara cero CVE ni aprobacion completa del eje D.
  Ver DEPENDENCIAS_TESTING.md para versiones corregidas y moderadas pendientes.
- G1 fue confirmado completo por el equipo el 31/10, tras la prueba del companero.
  Las verificaciones de Compose/persistencia continuan en cada pipeline.

## Avance de calidad Java del 01/11/2026

Ver [CALIDAD_JAVA_TESTING.md](CALIDAD_JAVA_TESTING.md) para el alcance de negocio,
los comandos de reproduccion, JaCoCo, PIT y SonarQube local. Los gates de negocio
80% lineas / 70% ramas y mutacion 60% ahora se ejecutan en verify por defecto y
en el job Java automatico. Se guardan tambien los reportes PIT. El workflow
manual de dominio reproduce ese control; Sonar remoto sigue requiriendo la
configuracion de cuenta/variables. Un resultado local o de rama no acredita el
tag final ni el cierre de los demas requisitos del TP.
