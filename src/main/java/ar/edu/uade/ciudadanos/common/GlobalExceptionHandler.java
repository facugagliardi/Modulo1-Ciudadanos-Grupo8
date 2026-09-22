package ar.edu.uade.ciudadanos.common;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

/** Traduce excepciones al contrato de errores (400/401/403/404/405/409/413/500). */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex, HttpServletRequest request) {
        return responder(ex.getStatus(), ex.getMessage(), request);
    }

    /** Bean Validation sobre los DTO: devuelve campo -> motivo. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidacion(MethodArgumentNotValidException ex,
                                                          HttpServletRequest request) {
        Map<String, String> errores = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> errores.putIfAbsent(error.getField(), error.getDefaultMessage()));
        ex.getBindingResult().getGlobalErrors()
                .forEach(error -> errores.putIfAbsent(error.getObjectName(), error.getDefaultMessage()));

        return ResponseEntity.badRequest().body(new ErrorResponse(
                OffsetDateTime.now(), HttpStatus.BAD_REQUEST.value(), HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Payload invalido", request.getRequestURI(), errores));
    }

    /**
     * Cuerpo ilegible. El caso importante es el campo desconocido: los DTO son
     * la lista blanca de lo que se acepta, y Jackson esta configurado para
     * fallar ante cualquier otro campo. El mensaje enumera los aceptados para
     * que el front no tenga que adivinar cual sobra.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleCuerpoIlegible(HttpMessageNotReadableException ex,
                                                              HttpServletRequest request) {
        Throwable causa = ex.getMostSpecificCause();

        if (causa instanceof UnrecognizedPropertyException desconocida) {
            String aceptados = desconocida.getKnownPropertyIds() == null ? "" : desconocida.getKnownPropertyIds()
                    .stream().map(Object::toString).sorted().collect(Collectors.joining(", "));
            return responder(HttpStatus.BAD_REQUEST,
                    "Campo no permitido: '" + desconocida.getPropertyName() + "'. Campos aceptados: " + aceptados,
                    request);
        }

        if (causa instanceof InvalidFormatException formato) {
            String campo = formato.getPath().isEmpty() ? "el cuerpo"
                    : formato.getPath().get(formato.getPath().size() - 1).getFieldName();
            String esperado = formato.getTargetType() != null && formato.getTargetType().isEnum()
                    ? "uno de: " + String.join(", ", nombresDeEnum(formato.getTargetType()))
                    : formato.getTargetType() == null ? "otro tipo" : formato.getTargetType().getSimpleName();
            return responder(HttpStatus.BAD_REQUEST,
                    "Valor invalido en '" + campo + "': se esperaba " + esperado, request);
        }

        return responder(HttpStatus.BAD_REQUEST, "Cuerpo de la peticion invalido o mal formado", request);
    }

    /** Un path variable o query param que no castea (ej. /ciudadanos/abc). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTipoInvalido(MethodArgumentTypeMismatchException ex,
                                                            HttpServletRequest request) {
        String esperado = ex.getRequiredType() == null ? "otro tipo"
                : ex.getRequiredType().isEnum() ? "uno de: " + String.join(", ", nombresDeEnum(ex.getRequiredType()))
                : ex.getRequiredType().getSimpleName();
        return responder(HttpStatus.BAD_REQUEST,
                "Valor invalido en '" + ex.getName() + "': se esperaba " + esperado, request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleParametroFaltante(MissingServletRequestParameterException ex,
                                                                 HttpServletRequest request) {
        return responder(HttpStatus.BAD_REQUEST, "Falta el parametro '" + ex.getParameterName() + "'", request);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ErrorResponse> handleParteFaltante(MissingServletRequestPartException ex,
                                                             HttpServletRequest request) {
        return responder(HttpStatus.BAD_REQUEST, "Falta la parte '" + ex.getRequestPartName() + "' del multipart",
                request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleArchivoGrande(MaxUploadSizeExceededException ex,
                                                             HttpServletRequest request) {
        return responder(HttpStatus.PAYLOAD_TOO_LARGE, "El archivo supera el tamano maximo permitido", request);
    }

    /**
     * Red de seguridad de las restricciones de la base (unique, check, FK).
     * Los servicios validan antes para dar un mensaje util; si algo se escapa
     * por una carrera entre dos requests, igual sale un 409 y no un 500.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleIntegridad(DataIntegrityViolationException ex,
                                                          HttpServletRequest request) {
        log.warn("Violacion de integridad en {}: {}", request.getRequestURI(), ex.getMostSpecificCause().getMessage());
        return responder(HttpStatus.CONFLICT,
                "La operacion viola una restriccion de unicidad o integridad de los datos", request);
    }

    /** Lo lanza @PreAuthorize cuando el rol no alcanza. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccesoDenegado(AccessDeniedException ex, HttpServletRequest request) {
        return responder(HttpStatus.FORBIDDEN, "Rol sin permiso para esta operacion", request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleRutaInexistente(NoResourceFoundException ex,
                                                               HttpServletRequest request) {
        return responder(HttpStatus.NOT_FOUND, "No existe el recurso solicitado", request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMetodoNoSoportado(HttpRequestMethodNotSupportedException ex,
                                                                 HttpServletRequest request) {
        return responder(HttpStatus.METHOD_NOT_ALLOWED,
                "Metodo " + ex.getMethod() + " no permitido en esta ruta", request);
    }

    /** Cuando el cliente cierra la conexion abruptamente (Tubería rota) durante la descarga. */
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void handleClienteDesconectado(AsyncRequestNotUsableException ex, HttpServletRequest request) {
        log.warn("El cliente se desconecto antes de terminar la respuesta en {}: {}", request.getRequestURI(), ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleNoControlado(Exception ex, HttpServletRequest request) {
        log.error("Error no controlado en {}", request.getRequestURI(), ex);
        return responder(HttpStatus.INTERNAL_SERVER_ERROR, "Error interno", request);
    }

    private ResponseEntity<ErrorResponse> responder(HttpStatus status, String mensaje, HttpServletRequest request) {
        return ResponseEntity.status(status).body(
                ErrorResponse.of(status.value(), status.getReasonPhrase(), mensaje, request.getRequestURI()));
    }

    private static java.util.List<String> nombresDeEnum(Class<?> tipo) {
        Object[] constantes = tipo.getEnumConstants();
        return constantes == null ? java.util.List.of()
                : java.util.Arrays.stream(constantes).map(Object::toString).sorted().toList();
    }
}
