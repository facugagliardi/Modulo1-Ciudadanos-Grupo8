# Cierre del punto tecnico Java - 01/11/2026

Este es el estado posterior a EVIDENCIA_CALIDAD_JAVA_2026-11-01.md, que conserva
las corridas intermedias. Meta interna: 03/11. Testing oficial: 10/11 antes de 13:30.
No declara completos todos los G ni sustituye las HU de Martin y Elias.

## Resultados comprobados

| Control | Resultado | Minimo |
| --- | --- | --- |
| Suite Java con PostgreSQL temporal | 239 tests, 0 fallos, 0 errores, 0 omitidos | Cero omisiones |
| JaCoCo negocio: 14 clases | 1251/1441 lineas = 86,81% | 80% |
| JaCoCo negocio: ramas | 491/646 = 76,01% | 70% |
| PIT | 551/751 detectados = 73,37% (plugin: 73%) | 60% |
| SonarQube local | Quality Gate OK, 8 condiciones, ninguna ignorada | Gate aprobado |
| Testing G3 en 372682a | 5 jobs success, duracion observada 187 s | <=15 min |

Se agregaron 91 casos efectivos respecto de los 148 de b128191: Contacto,
Documento, Solicitudes, Expedientes, Organizaciones, Representacion y Directorio,
mas regresiones de seguridad HTTP, errores y rollback real del listener.
No se mockearon los servicios bajo prueba ni se agregaron getters para inflar
porcentajes. Las entidades/repositorios/colaboradores sirven como dobles cuando
corresponde; HTTP usa la cadena real Spring Security con validador JWT doble.

JaCoCo y PIT conservaron el mismo alcance de negocio de 14 clases. Se verifico
automaticamente que la seleccion no fuera vacia y coincidiera. Los gates son
ahora parte de **mvn verify por defecto y del job Java automatico**. No se
redujeron umbrales ni se retiraron clases para conseguir verde.

### Mutacion y tiempos

XML final: 547 KILLED, 4 TIMED_OUT, 115 SURVIVED, 85 NO_COVERAGE, total 751.
PIT cuenta KILLED+TIMED_OUT como detectados. Incluso solo KILLED da 72,84%,
superior al 60%. No se presenta un timeout como una asercion que mato el mutante.
Se conservan DEFAULT, los supervivientes y las clases sin cobertura.

La ultima corrida local registro **7 h 14 min** entre inicio y fin; la causa de
ese tiempo transcurrido no fue determinada. No se usa para acreditar rendimiento
ni se presenta como una ejecucion menor a 15 minutos. Corridas previas completas
con estos controles tardaron 9:54 y 7:45 minutos. La evidencia de duracion del
pipeline es GitHub, no una extrapolacion de estas corridas locales.

## Sonar efectivo, no un verde vacio

Servidor local: SonarQube Community Build 26.10.0.133078, imagen oficial fijada
por digest en compose.sonar.yaml. Scanner Maven 5.8.0.7211. Analisis del commit
05284c03bde917a9fa4d3076f0ad67c5dfbef56f, cuyo backend permanece identico en
372682a. El analisis final tardo 2:59 minutos. No se envio codigo a SonarCloud.

El primer verde tenia conditions vacias y **no se acepto como cierre**. Se
configuro el gate TP Ciudadanos - codigo completo, conservando Sonar way y
agregando controles de codigo completo. Resultado final:

- Bugs, vulnerabilidades abiertas, Blocker, Critical y nuevas violaciones: 0.
- Duplicacion global: 0,9%, nueva: 0%, maximo 3% en ambos casos.
- Cobertura nueva: 86,4%, minimo 80%.
- ignoredConditions=false; sonar.qualitygate.ignoreSmallChanges=false.
- Cero issues abiertos y cero hotspots en la consulta final.

El porcentaje global Sonar no es el de dominio. Se corrigieron hallazgos de
transaccion, manejo de null, Optional, comparacion BigDecimal y CORS. S4502 se
reviso como falso positivo especifico, con comentario y pruebas que demuestran
Bearer explicito, sin autenticacion por cookies/Basic ni sesion. No se suprimio
la regla; la revision debe reabrirse si cambia ese contrato. Ver
REVISION_SONAR_JAVA.md y los JSON de revision para la justificacion completa.
Sigue siendo necesaria la revision humana del equipo; no acredita ZAP completo.

## Repositorio y CI del equipo

El codigo tecnico se publico como 05284c0 en aedelstein. Mientras se trabajaba
aparecio 372682a (correcciones frontend de QA del equipo). Se reviso que afectaba
solo 10 archivos frontend y se incorporo con fast-forward, sin reset ni pisar
trabajo ajeno. No se integraron main ni tag y no se desplego produccion.

[CI aprobado de 05284c0](https://github.com/facugagliardi/Modulo1-Ciudadanos-Grupo8/actions/runs/41326993757)
y [CI aprobado de 372682a](https://github.com/facugagliardi/Modulo1-Ciudadanos-Grupo8/actions/runs/41356765450).

En el segundo run, las cinco etapas aprobaron: Java con gates y SCA (181 s),
React (57 s), Compose/persistencia/SCA (183 s), secretos (11 s) y resultado G3
(2 s). Desde el primer job hasta el final: 187 s. Esto conserva las
verificaciones automaticas de G1 y acredita el avance en G3, no el CI del tag
final todavia inexistente.

## Evidencia y reproduccion

En el workspace padre, output/testing/calidad-java-2026-11-01/cierre-05284c0/
conserva Surefire, JaCoCo, PIT, logs y JSON Sonar. La carpeta padre conserva las
corridas intermedias y los JSON de run/jobs de GitHub. Esos archivos crudos estan
fuera del repo y no llegan con git clone. Los workflows guardan sus propios
artefactos. No se publican claves ni el archivo DPAPI del administrador local.

CALIDAD_JAVA_TESTING.md contiene los comandos versionados de reproduccion.
Sonar local queda preparado con compose.sonar.yaml y su helper. El workflow de
SonarCloud sigue listo para configurar proyecto/variables/secret si el equipo
elige llevar alli el analisis; no se afirma que ese servicio remoto haya corrido.

## Pendientes del TP que no se cierran con este resultado

HU y trazabilidad en Trello, paquete QA final, tag/main, demo y revision humana
de IA. Persisten los limites funcionales anotados en CALIDAD_JAVA_TESTING.md,
ademas de E2E, API/contratos, resiliencia completa, carga, ZAP y accesibilidad.
G6 sigue pendiente de la respuesta de GitHub Support sobre referencias antiguas;
no se reabrio ni duplico esa gestion.
