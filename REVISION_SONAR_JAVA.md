# Revision de Sonar Java - 01/11/2026

Se usa SonarQube Community Build 26.10.0.133078 local, imagen oficial fijada por
digest en compose.sonar.yaml. No se subio codigo a una cuenta compartida.
El primer Sonar way informo OK con `conditions: []`: **ese verde inicial no
acredita el gate exigido**. El helper configura un gate derivado, con controles
del codigo completo: cero bugs, vulnerabilidades, Blocker y Critical, y
duplicacion <=3%. No se desactivaron reglas ni se excluyeron archivos para pasar.
Tambien se desactiva la excepcion automatica para cambios pequenos
(`sonar.qualitygate.ignoreSmallChanges=false`), manteniendo 80% de cobertura
nueva y 3% de duplicacion nueva del gate original.
La cobertura del negocio y PIT se controlan aparte en Maven, sobre 14 clases.

## Hallazgos y tratamiento

- S2229, Blocker: el metodo de entrada onSocialDocumentationRequested llamaba
  por self-invocation a un metodo @Transactional sin transaccion externa. Se
  agrego @Transactional a la entrada. Una prueba con PostgreSQL y proxy Spring
  comprueba que un fallo de persistencia revierte tambien el registro anterior
  del evento. No acredita por si sola atomicidad del envio RabbitMQ.
- S2259: se lee getRequiredType una sola vez en una variable local y se resuelve
  explicitamente el caso null. Hay una regresion para ese caso.
- S3655: la seleccion del domicilio sucesor usa orElseThrow antes de modificar
  el titular. Se preserva el 409 al dar de baja el unico principal.
- S9351: los tests de porcentajes comparan valor numerico BigDecimal sin exigir
  escala identica. No cambia la regla de titularidad.
- S5122: se retiro el origen CORS universal. La lista es explicita, configurable
  con `APP_CORS_ALLOWED_ORIGINS`, y no admite cookies/credenciales CORS. La
  regresion HTTP comprueba 403 para un origen ajeno y preflight autorizado para
  localhost:8090. Despliegues con frontend en otro origen deben configurar su
  URL exacta; no se cambio ni desplego el servicio compartido.

## Revision especifica de CSRF (S4502)

La API usa exclusivamente JWT en `Authorization: Bearer`. El filtro no lee
tokens de cookies. SessionCreationPolicy.STATELESS evita recuperar identidad de
sesiones; Basic, formulario y logout web se deshabilitan explicitamente. El
frontend envia el token por header, no como cookie de autenticacion.

SeguridadHttpTest utiliza la cadena Spring Security real (solo el validador JWT
es un doble) y comprueba: cookie accessToken/JSESSIONID sin Bearer ->401;
Basic ->401; Bearer explicito ->200; sin Set-Cookie ni sesion creada. Tambien
comprueba CORS y ausencia de Access-Control-Allow-Credentials.

Si esas pruebas estan aprobadas y son posteriores al codigo revisado, la accion
`-RevisarCsrf` registra comentario y falso positivo **solo para S4502 en
SecurityConfig**, dentro de la instancia local. No hace supresiones globales,
no acepta otras vulnerabilidades y no ejecuta esa revision automaticamente al
analizar un proyecto nuevo. Su justificacion debe ser revisada por el equipo.

Reabrir este hallazgo si se agrega autenticacion por cookie, HTTP Basic,
formulario, sesion o credenciales que el navegador adjunta automaticamente.
Stateless por si solo no demuestra ausencia de CSRF. Esto no sustituye ZAP ni
la matriz de seguridad funcional de la entrega.

Fuentes oficiales: [CSRF en Spring Security](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
y [CORS](https://docs.spring.io/spring-security/reference/servlet/integrations/cors.html).
