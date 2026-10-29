package ar.edu.uade.ciudadanos.evento.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Topología definitiva de RabbitMQ 4.3 según directivas del Core:
 *
 * 1. Para publicar: Exchange compartido único 'muni.inbox' (tipo fanout, durable).
 *    Todos los módulos publican ahí. El Core se encarga del ruteo hacia las suscripciones.
 *
 * 2. Para recibir: Una cola por módulo 'q.ciudadanos'.
 *    Core la declara; el listener la consulta pasivamente.
 *
 * Core administra exchanges, colas y bindings. M1 no declara ninguno de esos
 * recursos: su usuario necesita permisos de publicacion/consumo, no configure.
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_MUNI_INBOX = "muni.inbox";
    public static final String QUEUE_CIUDADANOS = "q.ciudadanos";

    // No exponer beans Exchange, Queue o Binding: RabbitAdmin los declararia
    // al abrir una conexion, incluso si el listener esta desactivado.
    // El contenedor listener comprueba pasivamente la cola configurada al arrancar.

    @Bean
    public MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter jsonMessageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter);
        return template;
    }
}
