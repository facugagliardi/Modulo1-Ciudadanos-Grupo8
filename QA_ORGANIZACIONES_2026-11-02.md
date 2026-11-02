# Tanda API de organizaciones y permisos - 02/11/2026

## Alcance y version

Se ejecuto la coleccion bruno-tests-HU.zip provista por el equipo, con Bruno CLI
4.3.0, contra una copia aislada del ultimo commit publicado al empezar:
0b1eab33e99e71dac8e3f947409e8dab981258bc, rama aedelstein. Se hicieron luego
dos tandas sobre esa misma base con la correccion acotada de organizaciones.
Los hashes de los archivos corregidos y del ZIP original estan en los JSON de
cada tanda; el patch completo tambien se conserva.

No se probaron ni modificaron como parte de esta tanda los cambios sin publicar
de integracion con Obras. Se conservaron sus archivos y su estado. Las cinco
fuentes/tests de esta correccion se compararon byte a byte con el snapshot probado.

Entorno: proyecto Compose ciudadanos-qa-org-20261102, API en
http://127.0.0.1:18092/api, PostgreSQL y RabbitMQ separados, cuentas sinteticas
generadas por el inicializador. No se uso Render/Retool/Core como blanco de pruebas.
El primer arranque fallo por propietario root y modo 400 de la cookie Erlang del
volumen nuevo de RabbitMQ; se corrigio solo ese volumen QA y se comprobo healthy
antes de comenzar. Ese intento no cuenta como prueba funcional ni tiempo de G1.
No se borraron volumenes ni datos de la demo.

## Resultados reales de Bruno

| Tanda | Requests aprobados / total | Tests aprobados / total | CP completamente aprobados / ejecutados |
| --- | --- | --- | --- |
| Coleccion original, codigo base | 93/108 | 170/190 | 68/79 |
| Coleccion original, codigo corregido | 97/108 | 176/190 | 71/79 |
| Copia adaptada a errores de campo, codigo corregido | 103/108 | 182/190 | 75/79 |

108 requests incluyen 5 logins y 103 pasos de 79 CP distintos. La coleccion no
ejecuta los otros 7 CP del paquete de 86. Un request HTTP completado puede tener
tests fallidos: los totales se calcularon desde testResults y errores, no solo
desde el campo status del request en el JSON. Los conteos coinciden con Bruno.
Las tres corridas devolvieron exit code 1 porque persistieron tests fallidos;
no se ocultaron ni se marcaron como verdes.

La copia adaptada conserva todos los casos y expectativas. Se modificaron solo
seis lecturas de validacion: CP-008, CP-011, dos pasos de CP-019 y dos de CP-080.
El detalle ya viene en errores.razonSocial, errores.porcentajeCreador o
errores.codigo; message contiene el generico Payload invalido. Se mantuvieron
los status 400 y los mismos textos de detalle esperados. El ZIP original quedo
intacto y el manifiesto de esas seis adaptaciones es parte de la evidencia.
La mejora de 97 a 103 requests no corresponde a otros seis bugs corregidos.

## Defectos corregidos y re-probados

| Hallazgo local | Reproduccion en base | Correccion | Re-prueba |
| --- | --- | --- | --- |
| QA-ORG-001 / BUG-FE-007: auditor crea organizacion | JWT con rol AUDITOR, POST valido con titular explicito ->201; GET por CUIT confirma existe=true. Mismo body sin sesion ->401 | Autorizacion centralizada: ciudadano opera como titular; otros sujetos necesitan EDITAR_TERCEROS, antes de consultar/persistir | Auditor ->403 y existe=false; ciudadano ->201; mesa con titular explicito ->201; sin sesion ->401 |
| QA-ORG-002 / BUG-FE-008: empleado hereda identidad de ciudadano por ID | CP-020 y CP-023: mesa tiene ID numerico coincidente con un ciudadano y crea sin titular explicito ->201 | La identidad se determina por tipo de sujeto, no por existencia de ese numero en ciudadano. Empleado debe indicar titulares | CP-020 y CP-023 aprobados; 400 y consulta posterior confirma que no se creo |
| QA-ORG-003: razon social vacia al actualizar | CP-051: PUT acepta blanco ->200 | Validacion de texto no blanco si se envia el campo, conservando null para actualizaciones parciales | CP-051 aprobado, 400. Regresion valida tambien null y texto con contenido |

Los identificadores QA-* son locales de este informe, no tarjetas creadas en
Trello. Los enlaces/estados del tablero no fueron editados. La correccion del
alta no equivale a haber auditado toda la matriz de permisos de todos los endpoints.

## Fallos que quedan en la copia adaptada

| CP | Resultado observado | Clasificacion |
| --- | --- | --- |
| CP-015 | Se crea con otros titulares al 100% y no incluye al creador con 0% | A confirmar: el propio caso marca pendiente la regla de inclusion del creador; no cambiar porcentajes para forzar verde |
| CP-046 | Cambiar A de 60 a 70 dejando B en 40 devuelve 409; total sigue 100 | A confirmar: el caso espera redistribucion automatica, pero no envia ajuste del otro titular |
| CP-056 | Registrar ciudadano con CUIT usado por organizacion devuelve 201 | A confirmar: definir unicidad global entre esos dos tipos de registro |
| CP-086, dos requests | Codigo incorrecto de 6 digitos devuelve 200 y persiste verificado=true | Defecto abierto de verificacion de contactos: sigue sin comparar con un codigo emitido. No se cambio la expectativa de rechazo |

Son 5 requests fallidos de 4 CP. CP-015/046/056 siguen registrados como fallidos
contra la expectativa escrita; su clasificacion a confirmar no los convierte
en aprobados. CP-086 requiere completar emision/almacenamiento/validacion de
codigos y queda fuera de esta correccion acotada de organizaciones.

No ejecutados: CP-039 (cuenta ADMINISTRATIVO ausente del seed), CP-040
(caida/recuperacion de RabbitMQ), CP-057 (inspeccion SQL), CP-058/072/073
(navegador), CP-071 (token con antiguedad real mayor a 15 minutos).
No se simulo esa antiguedad ni se dieron por hechas esas pruebas manuales.

## Regresiones Java y gates

Regresion dirigida: 52 tests, 0 fallos/errores/omitidos. Suite completa sobre
el snapshot corregido: **261 tests, 0 fallos, 0 errores, 0 omitidos**, con
PostgreSQL y RabbitMQ reales aislados, incluidos los contratos M8 y outbox ya
publicados. No acredita los cambios de Obras todavia sin publicar.

Maven verify completo aprobo empaquetado, PMD, JaCoCo y PIT en **5 min 20 s**.
Dominio de 14 clases: **87,01% lineas (1226/1409), 76,64% ramas (492/642)**,
por encima de 80%/70%. PIT: **552/750 detectados =73,60%** (551 KILLED,
1 TIMED_OUT, 114 SURVIVED, 84 NO_COVERAGE); solo KILLED da 73,47%.
No se bajaron umbrales, excluyeron clases ni confundieron timeouts con aserciones.
El Sonar previo no se presenta como un nuevo analisis de este patch.

## Evidencia y siguiente trabajo

Carpeta local fuera del repo:
output/testing/qa-organizaciones-2026-11-02/ en el workspace padre. Contiene
HTML/JSON/JUnit por tanda, prueba auditor antes/despues, resumen.json,
resultados-por-caso.csv de 86 filas, manifiesto de adaptaciones, ZIP de la copia
adaptada, patch y logs Java. No llega con git clone. No se incluyen passwords,
JWT ni la configuracion privada; los reportes Bruno omiten headers y cuerpos.
La prueba puntual del auditor conserva solo payload/respuestas sinteticos de
organizaciones y status, sin guardar los cuerpos de login.

Estos CP-001..086 corresponden a la planilla de organizaciones/API; son distintos
de los CP-FE-001..085 del handoff frontend. No sumar ambos ni aplicar porcentajes
de casos al requisito de aprobacion de criterios. Los 7 manuales y los 4 CP
con fallos impiden declarar esta tanda completa/aprobada.

Siguiente: validar con el equipo las tres reglas a confirmar, completar los
manuales y tratar CP-086. Luego actualizar las tarjetas y la matriz con version,
resultado, evidencia y defecto, sin sobrescribir la historia de la primera tanda.
IA asistio en lectura, ejecucion, triage y correcciones. Queda revision humana.
