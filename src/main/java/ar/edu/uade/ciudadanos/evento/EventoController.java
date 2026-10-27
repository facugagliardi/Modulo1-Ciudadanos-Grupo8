package ar.edu.uade.ciudadanos.evento;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.common.ListaResponse;
import ar.edu.uade.ciudadanos.evento.dto.EventEnvelope;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedEvent;
import ar.edu.uade.ciudadanos.evento.entity.Evento;
import ar.edu.uade.ciudadanos.evento.entity.TipoEvento;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints HTTP para auditar, publicar y recibir eventos del sistema.
 * Permite probar de punta a punta el envio y recepcion de datos asincronicos.
 */
@RestController
@RequestMapping("/eventos")
public class EventoController {

    private final EventoService eventoService;
    private final EventPublisherService eventPublisherService;
    private final EventConsumerService eventConsumerService;
    private final ObjectMapper objectMapper;

    public EventoController(EventoService eventoService,
                            EventPublisherService eventPublisherService,
                            EventConsumerService eventConsumerService,
                            ObjectMapper objectMapper) {
        this.eventoService = eventoService;
        this.eventPublisherService = eventPublisherService;
        this.eventConsumerService = eventConsumerService;
        this.objectMapper = objectMapper;
    }

    /**
     * Lista eventos persistidos en PostgreSQL (EMITIDOS o RECIBIDOS).
     * Ejemplo: GET /eventos?tipo=EMITIDO
     */
    @GetMapping
    public ListaResponse<Evento> listar(@RequestParam(required = false) String tipo) {
        if (tipo != null) {
            try {
                TipoEvento tipoEvento = TipoEvento.valueOf(tipo.toUpperCase());
                if (tipoEvento == TipoEvento.EMITIDO) {
                    return ListaResponse.de(eventoService.listarEmitidos());
                } else {
                    return ListaResponse.de(eventoService.listarRecibidos());
                }
            } catch (IllegalArgumentException e) {
                throw ApiException.invalido("Tipo invalido. Valores permitidos: EMITIDO, RECIBIDO");
            }
        }
        // Devuelve emitidos y recibidos
        List<Evento> todos = new java.util.ArrayList<>(eventoService.listarEmitidos());
        todos.addAll(eventoService.listarRecibidos());
        return ListaResponse.de(todos);
    }

    /**
     * Obtiene el detalle de un evento persistido por su eventId.
     */
    @GetMapping("/{id}")
    public Evento obtener(@PathVariable String id) {
        return eventoService.buscarPorId(id)
                .orElseThrow(() -> ApiException.noEncontrado("Evento no encontrado con ID: " + id));
    }

    /**
     * Publica uno de los ejemplos oficiales del TP hacia RabbitMQ y lo guarda en la BD.
     * Ejemplos validos:
     * - citizen-registered
     * - citizen-blocked
     * - citizen-deceased
     * - citizen-address-updated
     * - casefile-resolved
     * - citizen-info-delivered
     * - organization-info-delivered
     * - organization-registered
     * - representation-granted
     * - representation-expired
     * - social-documentation-delivered
     */
    @PostMapping("/publicar-ejemplo/{nombreEjemplo}")
    public ResponseEntity<EventEnvelope<?>> publicarEjemplo(@PathVariable String nombreEjemplo) {
        EventEnvelope<?> publicado = eventPublisherService.publicarEjemplo(nombreEjemplo);
        return ResponseEntity.ok(publicado);
    }

    /**
     * Permite recibir cualquier evento JSON entrante enviado al sistema (simula recepcion de otro modulo).
     * Se valida idempotencia y se almacena en la tabla events como RECIBIDO.
     */
    @PostMapping("/recibir")
    public ResponseEntity<Map<String, Object>> recibirEvento(@RequestBody String rawJson) {
        try {
            JsonNode root = objectMapper.readTree(rawJson);

            String eventId = root.has("eventId") ? root.get("eventId").asText() : "INB-" + UUID.randomUUID();
            String eventType = root.has("eventType") ? root.get("eventType").asText() : "genericEvent";
            String subject = root.has("subject") ? root.get("subject").asText() : "general";

            boolean procesado = eventConsumerService.procesarEventoGenericoRecibido(
                    eventId,
                    "external",
                    subject,
                    eventType,
                    rawJson
            );

            if (!procesado) {
                return ResponseEntity.status(HttpStatus.OK).body(Map.of(
                        "mensaje", "Evento ya habia sido procesado previamente (idempotencia activa)",
                        "eventId", eventId,
                        "status", "DUPLICADO_IGNORADO"
                ));
            }

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "mensaje", "Evento recibido y almacenado exitosamente en PostgreSQL",
                    "eventId", eventId,
                    "eventType", eventType,
                    "status", "GUARDADO_RECIBIDO"
            ));
        } catch (Exception e) {
            throw ApiException.invalido("JSON invalido: " + e.getMessage());
        }
    }

    /**
     * Simula la recepcion del evento socialDocumentationRequested (del Modulo 8).
     * Lo almacena como RECIBIDO, crea Expediente y Solicitud de Documentacion en BD,
     * y dispara automaticamente la respuesta socialDocumentationDelivered.
     */
    @PostMapping("/recibir/social-documentation-requested")
    public ResponseEntity<Map<String, Object>> recibirSolicitudDocumentacion(@RequestBody SocialDocumentationRequestedEvent evento) {
        boolean procesado = eventConsumerService.procesarSocialDocumentationRequested(evento);

        if (!procesado) {
            return ResponseEntity.ok(Map.of(
                    "mensaje", "La solicitud ya habia sido procesada previamente",
                    "eventId", evento.eventId(),
                    "status", "IDEMPOTENTE"
            ));
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "mensaje", "Solicitud de documentacion de M8 recibida, expediente y requerimiento creados en BD, y respuesta emitida",
                "eventIdRecibido", evento.eventId(),
                "status", "PROCESADO_Y_RESPONDIDO"
        ));
    }

    /**
     * Simula la recepcion de un evento de expediente iniciado desde otro modulo (ej: Obras Publicas).
     * Crea automaticamente el Expediente en PostgreSQL (visible en 'Mis expedientes')
     * y, si incluye documentacion complementaria, crea la solicitud (visible en 'Documentacion que te piden').
     */
    @PostMapping("/recibir/expediente-iniciado")
    public ResponseEntity<Map<String, Object>> recibirExpedienteIniciado(
            @RequestBody(required = false) Map<String, Object> body) {
        String eventId = (body != null && body.containsKey("eventId"))
                ? String.valueOf(body.get("eventId"))
                : UUID.randomUUID().toString();

        String rawJson;
        try {
            if (body != null) {
                rawJson = objectMapper.writeValueAsString(body);
            } else {
                rawJson = "{\"eventType\":\"casefileInitiated\",\"data\":{\"caratula\":\"Aprobacion y ejecucion de obra publica\",\"areaIniciadora\":\"Obras Publicas\",\"requiredDocument\":\"CERTIFICADO_DOMICILIO\"}}";
            }
        } catch (Exception e) {
            rawJson = "{}";
        }

        boolean procesado = eventConsumerService.procesarEventoGenericoRecibido(
                eventId,
                "casefile",
                "expediente",
                "casefileInitiated",
                rawJson
        );

        if (!procesado) {
            return ResponseEntity.ok(Map.of(
                    "mensaje", "El evento de expediente ya habia sido procesado previamente (idempotencia activa)",
                    "eventId", eventId,
                    "status", "DUPLICADO_IGNORADO"
            ));
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "mensaje", "Evento de expediente procesado: registrado en PostgreSQL e impactado en 'Mis expedientes' y 'Documentacion que te piden'",
                "eventId", eventId,
                "status", "EXPEDIENTE_CREADO_EXITOSAMENTE"
        ));
    }
}
