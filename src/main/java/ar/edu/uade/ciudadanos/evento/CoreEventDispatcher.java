package ar.edu.uade.ciudadanos.evento;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.evento.dto.SocialDocumentationRequestedEvent;
import ar.edu.uade.ciudadanos.intermodulo.TramitesExternosService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

/** Una cola multiplexada: despacha por eventType antes de deserializar data. */
@Service
public class CoreEventDispatcher {
    private static final Logger log = LoggerFactory.getLogger(CoreEventDispatcher.class);
    private final ObjectMapper mapper;
    private final TramitesExternosService tramites;
    private final EventConsumerService documentos;

    public CoreEventDispatcher(ObjectMapper mapper, TramitesExternosService tramites, EventConsumerService documentos) {
        this.mapper = mapper;
        this.tramites = tramites;
        this.documentos = documentos;
    }

    @RabbitListener(queues = "${app.events.queue:q.ciudadanos}")
    public void recibir(Message mensaje) {
        try {
            procesar(new String(mensaje.getBody(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            // Core administra backoff/DLQ. No confirmar errores de persistencia ni reenviarlos en bucle.
            throw new AmqpRejectAndDontRequeueException("No se pudo procesar el evento del Core", e);
        }
    }

    public String procesar(String rawJson) {
        try {
            JsonNode evento = mapper.readTree(rawJson);
            if (evento == null || !evento.isObject()) throw ApiException.invalido("El evento debe ser un objeto JSON");
            String tipo = evento.path("eventType").asText();
            if (TramitesExternosService.EVENTOS.contains(tipo)) return tramites.procesar(evento);
            if (tipo.equals("socialDocumentationRequested")) {
                if (!evento.path("sourceModule").asText().equals("desarrollo-social")) {
                    throw ApiException.invalido("socialDocumentationRequested debe provenir de desarrollo-social");
                }
                // Bean distinto: la llamada atraviesa el proxy transaccional.
                return documentos.procesarSocialDocumentationRequested(
                        mapper.treeToValue(evento, SocialDocumentationRequestedEvent.class)) ? "APLICADO" : "DUPLICADO";
            }
            log.debug("Evento sin consumidor de negocio en M1: {}", tipo);
            return "IGNORADO";
        } catch (java.io.IOException e) {
            throw ApiException.invalido("JSON de evento invalido");
        }
    }
}
