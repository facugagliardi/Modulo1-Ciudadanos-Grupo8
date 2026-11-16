# ADR-003: Implementación del Patrón Ports and Adapters (Arquitectura Hexagonal) para Almacenamiento de Documentación

## Estado
Aceptado

## Fecha
2026-11-16

## Contexto y Problemática
El subsistema de documentación de Ciudadanos (`ar.edu.uade.ciudadanos.documentacion`) es responsable de la recepción, versionado y custodia de documentos adjuntos de personas físicas y jurídicas (DNI digitalizado, constancias de CUIL/CUIT, estatutos societarios y poderes de representación, cubriendo los requerimientos RF-23 a RF-26).

Los servicios de negocio (`DocumentoService`, `SolicitudDocumentacionService`) deben coordinar reglas de negocio tales como:
- Control de tipos MIME y extensiones admitidas (`ArchivosPermitidos.java`).
- Restricción de tamaño máximo de archivo.
- Registro de auditoría (`cargadoPor`, `validadoPor`).
- Versionado secuencial del legajo del ciudadano.

Acoplar directamente los servicios de negocio al sistema de archivos local (`java.io.File`, `java.nio.file.Files`) o a una librería específica de proveedor cloud (como el SDK de AWS S3 o Azure Blob) introduce un fuerte acoplamiento a la infraestructura, dificultando las pruebas unitarias y limitando la portabilidad del backend entre entornos de desarrollo local, Docker Compose y despliegues en la nube (Render / AWS).

## Decisión
Se adopta el patrón estructural **Ports and Adapters** (Arquitectura Hexagonal):

1. **Puerto de Salida (Outbound Port):** Se define la interfaz Java `AlmacenamientoArchivos` (`ar.edu.uade.ciudadanos.documentacion.service.AlmacenamientoArchivos`), que abstrae el contrato de persistencia de archivos físicos:
   - `String guardar(String nombreOriginal, byte[] contenido)`
   - `byte[] leer(String identificadorOPath)`
   - `void eliminar(String identificadorOPath)`

2. **Adaptador Concreto (Driven Adapter):** Se implementa la clase `AlmacenamientoLocal` (`ar.edu.uade.ciudadanos.documentacion.service.AlmacenamientoLocal`) como componente Spring (`@Service`), implementando `AlmacenamientoArchivos`. Esta clase administra la escritura y lectura en el sistema de archivos del servidor/contenedor, resolviendo rutas base de almacenamiento a partir de propiedades de configuración (`app.storage.dir` o variable de entorno `APP_STORAGE_DIR`).

3. **Inversión de Dependencias:** `DocumentoService` interactúa exclusivamente con el puerto `AlmacenamientoArchivos` a través de inyección de dependencias por constructor. Desconoce por completo si los bytes están siendo almacenados en un disco local, en un volumen compartido o en un almacenamiento de objetos en la nube.

## Consecuencias

### Positivas
- **Independencia de Infraestructura:** El núcleo de negocio de legajos y documentación permanece completamente agnóstico al mecanismo físico de almacenamiento.
- **Portabilidad y Evolución:** Permite migrar a almacenamiento distribuido o en la nube (ej. `AlmacenamientoS3 implements AlmacenamientoArchivos`) creando un nuevo adaptador sin modificar una sola línea de lógica en `DocumentoService`.
- **Testabilidad Aislada:** Facilita la creación de tests unitarios rápidos mediante mocks o stubs en memoria de `AlmacenamientoArchivos`, sin depender de permisos de escritura de disco en el entorno de testing.

### Negativas / Compensaciones
- Introduce una capa de indirección (interfaz + clase adaptadora) en comparación con un acceso directo al sistema de archivos.
- `AlmacenamientoLocal` requiere asegurar que el directorio configurado en el sistema anfitrión tenga permisos adecuados de lectura y escritura.
