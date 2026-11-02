package ar.edu.uade.ciudadanos.evento;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** La intencion comparte transaccion con el negocio; solo filas confirmadas llegan al broker. */
@Service
@EnableScheduling
public class EventOutbox {
    private static final Logger log = LoggerFactory.getLogger(EventOutbox.class);
    private final JdbcTemplate jdbc;
    private final RabbitTemplate rabbit;
    private final TransactionTemplate transaction;
    @Value("${app.events.exchange:muni.inbox}") private String exchange;
    @Value("${app.events.outbox-enabled:true}") private boolean enabled;

    public EventOutbox(JdbcTemplate jdbc, RabbitTemplate rabbit, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.rabbit = rabbit;
        this.transaction = new TransactionTemplate(manager);
    }

    @Transactional
    public void encolar(String eventId, String routingKey, String payload) {
        jdbc.update("INSERT INTO event_outbox(event_id,routing_key,payload) VALUES (?,?,?)",
                eventId, routingKey, payload);
    }

    @Scheduled(fixedDelayString = "${app.events.outbox-delay-ms:5000}")
    public void despacharProgramado() {
        if (enabled) despachar();
    }

    public void despachar() {
        for (int i = 0; i < 20; i++) {
            try {
                if (!Boolean.TRUE.equals(transaction.execute(status -> despacharUno()))) return;
            } catch (RuntimeException e) {
                log.warn("Outbox pendiente; se reintentara en el siguiente ciclo: {}", e.getClass().getSimpleName());
                return;
            }
        }
    }

    // Un crash tras ack puede repetir el mismo eventId. El consumidor debe deduplicarlo.
    boolean despacharUno() {
        var rows = jdbc.queryForList("""
                SELECT event_id,routing_key,payload FROM event_outbox
                WHERE sent_at IS NULL AND next_attempt_at <= now()
                ORDER BY created_at,event_id LIMIT 1 FOR UPDATE SKIP LOCKED
                """);
        if (rows.isEmpty()) return false;
        var row = rows.getFirst();
        String id = (String) row.get("event_id");
        try {
            MessageProperties properties = new MessageProperties();
            properties.setContentType(MessageProperties.CONTENT_TYPE_JSON);
            properties.setContentEncoding("UTF-8");
            properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
            properties.setMessageId(id);
            CorrelationData correlation = new CorrelationData(id);
            rabbit.send(exchange, (String) row.get("routing_key"),
                    new Message(((String) row.get("payload")).getBytes(StandardCharsets.UTF_8), properties), correlation);
            var confirm = correlation.getFuture().get(5, TimeUnit.SECONDS);
            if (!confirm.isAck() || correlation.getReturned() != null) throw new IllegalStateException("Entrega no confirmada");
            jdbc.update("UPDATE event_outbox SET sent_at=now(),attempts=attempts+1 WHERE event_id=?", id);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Despacho interrumpido", e);
        } catch (Exception e) {
            jdbc.update("""
                    UPDATE event_outbox SET attempts=attempts+1,next_attempt_at=now()+interval '30 seconds'
                    WHERE event_id=?
                    """, id);
            log.warn("Evento {} sigue pendiente de entrega: {}", id, e.getClass().getSimpleName());
        }
        return true;
    }
}
