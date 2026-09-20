package ar.edu.uade.ciudadanos.mensajeria;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jms.annotation.EnableJms;
import org.springframework.jms.support.converter.MappingJackson2MessageConverter;
import org.springframework.jms.support.converter.MessageType;

/** Configuracion JMS para el laboratorio de cola punto a punto. */
@Configuration
@EnableJms
@ConditionalOnProperty(prefix = "app.mensajeria.p2p", name = "enabled", havingValue = "true")
public class MensajeriaP2PConfig {

    /** Los mensajes viajan como TextMessage con un JSON legible en el broker. */
    @Bean
    MappingJackson2MessageConverter jmsMessageConverter(ObjectMapper objectMapper) {
        MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
        converter.setObjectMapper(objectMapper);
        converter.setTargetType(MessageType.TEXT);
        converter.setTypeIdPropertyName("_type");
        return converter;
    }
}
