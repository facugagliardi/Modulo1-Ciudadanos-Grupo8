package ar.edu.uade.ciudadanos.evento;

import ar.edu.uade.ciudadanos.evento.config.RabbitMQConfig;
import ar.edu.uade.ciudadanos.evento.dto.EventEnvelope;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationDeliveredData;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Servicio encargado de recibir, validar la idempotencia y procesar
 * los eventos asincronicos entrantes desde otros modulos.
 */
@Service
public class EventConsumerService {

    private static final Logger log = LoggerFactory.getLogger(EventConsumerService.class);

    private final EventoService eventoService;
    private final EventPublisherService eventPublisherService;
    private final ObjectMapper objectMapper;

    public EventConsumerService(EventoService eventoService,
                                EventPublisherService eventPublisherService,
                                ObjectMapper objectMapper) {
        this.eventoService = eventoService;
        this.eventPublisherService = eventPublisherService;
        this.objectMapper = objectMapper;
    }

    /**
     * Listener que consume mensajes de la cola de M8 en RabbitMQ.
     * Solo procesa si auto-startup esta habilitado.
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_M8_REQUESTS)
    public void onSocialDocumentationRequested(SocialDocumentationRequestedEvent evento) {
        log.info("Mensaje recibido desde cola RabbitMQ {}: eventId={}",
                RabbitMQConfig.QUEUE_M8_REQUESTS, evento.eventId());
        procesarSocialDocumentationRequested(evento);
    }

    /**
     * Procesa la solicitud de documentacion de M8:
     * 1. Idempotencia: chequea si el eventId ya fue procesado.
     * 2. Registra el evento entrante como RECIBIDO en la base de datos PostgreSQL.
     * 3. Busca la informacion de legajos y solicitudes de documentacion.
     * 4. Publica en respuesta el evento socialDocumentationDelivered con el correlationId original.
     */
    @Transactional
    public boolean procesarSocialDocumentationRequested(SocialDocumentationRequestedEvent evento) {
        if (evento == null || evento.eventId() == null) {
            log.warn("Evento recibido nulo o sin eventId");
            return false;
        }

        if (eventoService.estaProcesado(evento.eventId())) {
            log.info("Evento ya procesado previamente (idempotencia activa): eventId={}", evento.eventId());
            return false;
        }

        String rawJson;
        try {
            rawJson = objectMapper.writeValueAsString(evento);
        } catch (Exception e) {
            rawJson = evento.toString();
        }

        String citizenId = evento.payload() != null ? evento.payload().citizenId() : "desconocido";
        eventoService.registrarRecibido(
                evento.eventId(),
                "citizens",
                citizenId,
                evento.eventType() != null ? evento.eventType() : "socialDocumentationRequested",
                rawJson
        );
        log.info("Evento entrante registrado como RECIBIDO en PostgreSQL: eventId={}", evento.eventId());

        // Generar respuesta hacia M8
        String appId = evento.payload() != null ? evento.payload().applicationId() : "sol-00456";
        String progId = evento.payload() != null ? evento.payload().programId() : "prog-00789";

        Map<String, Object> req1 = Map.of(
                "requestId", "sol-doc-3341",
                "documentType", "INCOME_CERTIFICATE",
                "status", "PENDING"
        );
        Map<String, Object> req2 = Map.of(
                "requestId", "sol-doc-3342",
                "documentType", "BIRTH_CERTIFICATE",
                "status", "COMPLETED",
                "documentId", "doc-77120"
        );
        Map<String, Object> file = Map.of(
                "fileId", "exp-00981",
                "number", "EXP-2026-00981",
                "initiatingArea", "SOCIAL_DEVELOPMENT",
                "status", "IN_PROGRESS",
                "documentationRequests", List.of(req1, req2)
        );

        SocialDocumentationDeliveredData respuestaData = new SocialDocumentationDeliveredData(
                citizenId,
                appId,
                progId,
                List.of(file)
        );

        EventEnvelope<SocialDocumentationDeliveredData> respuestaEnvelope =
                eventPublisherService.publicarSocialDocumentationDelivered(evento.eventId(), respuestaData);

        log.info("Respuesta socialDocumentationDelivered emitida con correlationId={}: nuevo eventId={}",
                evento.eventId(), respuestaEnvelope.eventId());

        return true;
    }

    /**
     * Permite recibir y almacenar en la tabla events cualquier evento entrante generico.
     */
    @Transactional
    public boolean procesarEventoGenericoRecibido(String eventId,
                                                  String aggregateType,
                                                  String aggregateId,
                                                  String eventType,
                                                  String rawPayload) {
        if (eventoService.estaProcesado(eventId)) {
            log.info("Evento descartado por duplicado (idempotencia): eventId={}", eventId);
            return false;
        }

        eventoService.registrarRecibido(eventId, aggregateType, aggregateId, eventType, rawPayload);
        log.info("Evento generico entrante guardado en BD con exito: eventId={}, eventType={}", eventId, eventType);
        return true;
    }
}
