# Contratos de referencia de M3

Schemas data de M3 v0.7, consultados el 2 de noviembre de 2026:

- https://github.com/ignacionogue/DesarrolloDeAplicacionesIIBack/blob/develop/src/main/resources/contracts/m3/publicWorksProjectApproved.data.schema.json (blob fec308239c05f3ccc6f468d15eab455bfac9a987).
- https://github.com/ignacionogue/DesarrolloDeAplicacionesIIBack/blob/develop/src/main/resources/contracts/m3/publicWorksProjectCompleted.data.schema.json (blob 60399b250269bae3fef0fbca3a800448c894210a).

Las pruebas usan los ejemplos del contrato y verifican campos obligatorios, UUID, origen, fechas con offset, importes no negativos y rechazo de campos extra. No se incorporo una dependencia adicional de JSON Schema en produccion.
