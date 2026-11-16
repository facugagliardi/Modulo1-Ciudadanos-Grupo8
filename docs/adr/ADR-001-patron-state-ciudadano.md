# ADR-001: Implementación del Patrón State en el Ciclo de Vida de Ciudadano

## Estado
Aceptado

## Fecha
2026-11-16

## Contexto y Problemática
En el Módulo 1 (Ciudadanos), la entidad central `Ciudadano` (`ar.edu.uade.ciudadanos.persona.entity.Ciudadano`) gestiona el ciclo de vida de los vecinos registrados en el municipio. Dicho ciclo de vida contempla cuatro estados bien definidos:
- `ACTIVO`: Ciudadano operativo con capacidad para tramitar y relacionarse.
- `INACTIVO`: Ciudadano dado de baja temporalmente o sin actividad reciente.
- `BLOQUEADO`: Ciudadano suspendido administrativamente por irregularidades o revisión requerida.
- `FALLECIDO`: Estado terminal e irreversible acreditado por Registro Civil.

El requerimiento funcional RF-05 exige validar estrictamente las transiciones de estado permitidas, garantizando que un estado terminal como `FALLECIDO` no pueda retornar a ningún otro estado y que no se realicen transiciones inválidas.

Históricamente, la lógica de validación se encontraba centralizada en una estructura externa utilitaria (`TransicionesEstado.java`) mediante mapas estáticos (`EnumMap`) y comprobaciones procedurales. Esta aproximación presentaba limitaciones:
1. Violación del principio de Responsabilidad Única (SRP) y Abierto/Cerrado (OCP): la entidad `Ciudadano` no gobernaba su propio comportamiento de estado, dependiendo de verificadores externos.
2. Dificultad para asociar comportamientos o reglas de negocio específicas según el estado actual (e.g. validación de operaciones permitidas o terminalidad).

## Decisión
Se implementa el patrón de diseño comportamental **State (GoF)** para modelar el ciclo de vida de la entidad `Ciudadano`:

1. **Abstracción:** Se define la interfaz `CiudadanoState` en el paquete `ar.edu.uade.ciudadanos.persona.state`, exponiendo los métodos:
   - `EstadoCiudadano getEstado()`
   - `Set<EstadoCiudadano> getTransicionesPermitidas()`
   - `boolean esTerminal()`
   - `CiudadanoState cambiarEstado(EstadoCiudadano nuevoEstado)`
   - Método de fábrica estático `CiudadanoState.de(EstadoCiudadano)` para resolver la instancia polimórfica adecuada.

2. **Clase Base Abstracta:** Se implementa `AbstractCiudadanoState` que encapsula la validación común de transiciones y emite excepciones descriptivas del dominio ante transiciones inválidas o intentos de transición desde estados terminales.

3. **Estados Concretos:** Se implementan clases polimórficas para cada estado:
   - `ActivoState`: Permite transicionar a `INACTIVO`, `BLOQUEADO` y `FALLECIDO`.
   - `InactivoState`: Permite transicionar a `ACTIVO`, `BLOQUEADO` y `FALLECIDO`.
   - `BloqueadoState`: Permite transicionar a `ACTIVO`, `INACTIVO` y `FALLECIDO`.
   - `FallecidoState`: Estado terminal; su conjunto de transiciones permitidas es vacío y rechaza cualquier cambio.

4. **Persistencia JPA:** Para no alterar el esquema de base de datos PostgreSQL ni requerir migraciones complejas de tipos polimórficos en JPA, la entidad `Ciudadano` conserva su columna `estado` mapeada como `@Enumerated(EnumType.STRING)`, manteniendo un atributo `@Transient private CiudadanoState state`. Al invocar `ciudadano.cambiarEstado(nuevoEstado)`, la entidad delega la validación y transición a su objeto de estado actual, sincronizando tanto la instancia `state` como el valor persistible `estado`.

5. **Servicio de Aplicación:** `CiudadanoService.cambiarEstado(...)` delega la transición directamente a `ciudadano.cambiarEstado(nuevo)`, consolidando a la entidad de dominio como la autoridad de su propio ciclo de vida.

## Consecuencias

### Positivas
- **Alta Cohesión y Encapsulamiento:** Las reglas de transición y las propiedades de cada estado residen en su clase correspondiente.
- **Extensibilidad:** Incorporar nuevos estados o reglas de negocio asociadas a un estado no afecta al resto de las implementaciones.
- **Transparencia en Persistencia:** Total compatibilidad con JPA/Hibernate y las consultas nativas existentes sin modificar tablas ni columnas SQL.
- **Facilidad de Testeo:** Cada estado se testea de forma unitaria y aislada (`CiudadanoStateTest`).

### Negativas / Compensaciones
- Se introducen clases adicionales en el paquete `ar.edu.uade.ciudadanos.persona.state`.
- Requiere mantener sincronizado el campo `@Transient state` ante asignaciones directas del setter de persistencia.
