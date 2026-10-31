# Revision de dependencias del frontend

Fecha: 31/10/2026. Alcance: el arbol completo de npm, incluidas herramientas de
desarrollo, instalado desde frontend/package-lock.json.

## Cambios

| Paquete | Antes | Despues |
| --- | --- | --- |
| Vite | 6.4.3 | 8.3.5 |
| @vitejs/plugin-react | 4.7.0 | 6.1.2 |
| Vitest y coverage-v8 | 2.1.9 | 4.1.12 |
| brace-expansion | 5.0.9 | 5.0.12 |
| source-map-js | 1.2.1 | 1.2.2 |

La actualizacion de Vitest retira tinypool 1.1.1 del arbol instalado. El lockfile
incluye las resoluciones transitivas actualizadas. No se aplico audit fix --force
ni se impusieron versiones mayores de transitivas mediante overrides.

La revision posterior de imagenes llevo Vite a 8.3.5 y plugin-react a 6.1.2 para
retirar el esbuild con Go vulnerable de la etapa de compilacion. El nuevo
minificador detecto dos selectores de botones de archivo invalidos: se corrigio
su sintaxis manteniendo los estilos previstos. Ver SCA_JAVA_DOCKER.md.

Con Vitest 4 se limpia el historial de mocks entre casos. Su calculo de cobertura
detecta mas caminos que la version anterior: se agregaron casos de permisos,
renovacion de sesion, respuestas del servidor, legajos incompletos y propiedades
de organizaciones. Se mantienen los umbrales de 85% y las exclusiones previas.

Esas pruebas detectaron dos defectos corregidos: una traza sin rol rompia el
formateo de auditoria; la baja de una propiedad usaba un nombre de prop incorrecto
y mostraba Confirmar en lugar de Dar de baja.

## Resultado de npm audit

Antes: 19 entradas afectadas (13 moderadas, 3 altas, 3 criticas).
Despues: 7 entradas afectadas (7 moderadas, 0 altas, 0 criticas).
Son entradas de paquetes afectados, no un conteo de vulnerabilidades unicas.

El workflow ejecuta npm audit --audit-level=high e incluye el JSON en el artifact
frontend-reportes. Una alerta alta o critica hace fallar la etapa. Las moderadas
no se ocultan ni se declaran resueltas.

## Hallazgos moderados pendientes

- minimatch y su cadena de ESLint: posible denegacion de servicio por patrones
  glob. [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
  Tratamiento pendiente: una combinacion compatible de ESLint y minimatch con
  correccion del proveedor. El audit sugiere un cambio mayor hacia una version
  antigua de ESLint, que no se aplico como supuesta correccion automatica.
- react-router/react-router-dom: redireccion abierta y deserializacion en SSR.
  [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6),
  [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg).
  Tratamiento pendiente: migrar y verificar React Router 7 (audit indica 7.18.5).
  Mantener las alertas abiertas hasta completar el analisis de aplicabilidad y
  la correccion; este documento no las considera mitigadas.

El escaneo de Maven y de imagenes Docker se documenta en SCA_JAVA_DOCKER.md.
Estos resultados no acreditan por si solos todo el eje de seguridad ni cierran G6.

## Reproducir

Desde frontend, con Node 22 compatible con el workflow:

```text
npm ci
npm run lint
npm run test:coverage
npm audit --audit-level=high
npm run build
```

Los reportes generados no deben agregarse al repositorio. Guardar evidencia de la
ejecucion final y su commit en el paquete de QA.
