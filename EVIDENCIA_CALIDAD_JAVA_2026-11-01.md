# Evidencia Java del 01/11/2026

Referencia de inicio: b128191, rama aedelstein, arbol inicialmente limpio salvo
DocumentoServiceTest iniciado en el turno anterior. Se consulto origin sin
encontrar commits posteriores en aedelstein. No se integro ni sobrescribio main.

## Suite y cobertura

Se agregaron 46 casos efectivos: ContactoServiceTest (11), DocumentoServiceTest
(16), SolicitudDocumentacionServiceTest (11), ExpedienteServiceTest (8).
Las cuatro pruebas del turno anterior estan incluidas en esos 16 de Documento.
No se modificaron reglas de negocio para acomodar las pruebas.

Ultima suite: **194 tests, 0 fallos, 0 errores, 0 omitidos**, incluidos los 11
tests PostgreSQL, con base temporal creada y eliminada por el helper. Maven
completo compilacion, tests, empaquetado, JaCoCo y PMD antes de iniciar PIT.
Reportes Surefire y JaCoCo leidos de esa corrida, no estimaciones.

| Clase | Lineas | Ramas |
| --- | --- | --- |
| ContactoService | 69/69 = 100% | 18/20 = 90% |
| DocumentoService | 90/92 = 97,83% | 28/28 = 100% |
| SolicitudDocumentacionService | 67/67 = 100% | 14/14 = 100% |
| ExpedienteService | 91/94 = 96,81% | 20/24 = 83,33% |
| Dominio completo (14 clases) | 933/1442 = 64,70% | 348/648 = 53,70% |

El gate JaCoCo se ejecuto y **fallo**, seleccionando las 14 clases: no cumple
80%/70%. Hubo un error inicial de configuracion de includes que seleccionaba
cero clases; se corrigio a rutas `.class` y se agrego comprobacion de alcance
no vacio y consistente con PIT. El falso verde inicial no es evidencia valida.

Primera corrida de los tests nuevos: un error UnfinishedStubbing en la
preparacion de un mock de Contacto; corregido antes de las corridas completas.
El sandbox bloqueo la auto-adjuncion de Mockito en la primera prueba de Documento;
las ejecuciones acreditadas se hicieron fuera de ese bloqueo con Java 21.

## Mutacion

PIT 1.30.1 + soporte JUnit5 1.2.3, operadores DEFAULT, 4 threads, alcance de las
mismas 14 clases, umbral 60%. Primera corrida sin PostgreSQL: 34%, insuficiente
como medicion completa. Corrida posterior con PostgreSQL y antes de agregar
Expedientes: 751 mutantes, 338 KILLED, 2 TIMED_OUT, 114 SURVIVED, 297 NO_COVERAGE;
PIT informa 340 detectados (45%) y falla el umbral. Duro 4 min 26 s.
Los timeouts no se presentan como aserciones que mataron mutantes.

Ultima corrida, incluyendo Expedientes: **751 mutantes, 373 KILLED,
2 TIMED_OUT, 118 SURVIVED y 258 NO_COVERAGE**. PIT informa 375 detectados,
**50% redondeado (375/751 = 49,93%)**, por debajo del 60%, y devuelve error.
Los eliminados por aserciones representan 373/751 = 49,67%. El proceso completo
`verify` + PIT duro **4 min 57 s**; no equivale al tiempo de CI.
Los cuatro servicios trabajados tienen 32/41, 45/59, 24/27 y 39/47 mutantes
KILLED, respectivamente (Contacto, Documento, Solicitudes, Expedientes).
No se ocultaron los supervivientes ni se excluyeron clases para conseguir verde.

## CI/Sonar y limites de la evidencia

Se validaron sintaxis YAML y `git diff --check`. Los workflows nuevos son
manuales y no se ejecutaron en GitHub durante esta evidencia. Se conserva
Testing G3 automatico. No se midio su duracion nueva ni se acredita CI verde
sobre este avance, main o tag.

Sonar tiene plugin fijado, importacion JaCoCo, espera del Quality Gate y workflow
con precondiciones de configuracion. No hay analisis Sonar ejecutado ni gate
aprobado; hay que comprobar cuenta/proyecto, variables y secret en GitHub.

Evidencia cruda local fuera del repo: `output/testing/calidad-java-2026-11-01/`
en el workspace padre, con Surefire, JaCoCo, resumen del dominio y PIT. No se
descarga con git clone. Tras una ejecucion de los workflows manuales, sus
artefactos deben enlazarse al paquete QA. Ver CALIDAD_JAVA_TESTING.md para
reproduccion, alcance y defectos/riesgos funcionales observados.

Siguiente prioridad: OrganizacionService (428 lineas totales, 290 sin cubrir en
esta referencia), luego Ciudadano, Domicilio, Representacion, Relacion y Directorio.
Los umbrales siguen pendientes: no se declararon completos G3/G4 ni el TP.
