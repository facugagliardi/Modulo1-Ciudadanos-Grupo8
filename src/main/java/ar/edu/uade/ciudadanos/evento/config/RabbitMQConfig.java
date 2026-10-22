package ar.edu.uade.ciudadanos.evento.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String QUEUE_M8_REQUESTS = "modulo1.m8.documentation.requests";
    public static final String QUEUE_EVENTS_INBOUND = "modulo1.events.inbound";

    public static final String ROUTING_KEY_M8_REQUESTED = "m8.documentation.requested";
    public static final String ROUTING_KEY_INBOUND = "modulo1.inbound.#";

    @Value("${app.events.exchange:modulo1.topic.exchange}")
    private String exchangeName;

    @Bean
    public TopicExchange exchange() {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue queueM8Requests() {
        return new Queue(QUEUE_M8_REQUESTS, true);
    }

    @Bean
    public Queue queueEventsInbound() {
        return new Queue(QUEUE_EVENTS_INBOUND, true);
    }

    @Bean
    public Binding bindingM8Requests(Queue queueM8Requests, TopicExchange exchange) {
        return BindingBuilder.bind(queueM8Requests).to(exchange).with(ROUTING_KEY_M8_REQUESTED);
    }

    @Bean
    public Binding bindingEventsInbound(Queue queueEventsInbound, TopicExchange exchange) {
        return BindingBuilder.bind(queueEventsInbound).to(exchange).with(ROUTING_KEY_INBOUND);
    }

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
