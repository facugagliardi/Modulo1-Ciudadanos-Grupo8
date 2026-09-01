package ar.edu.uade.ciudadanos.evento.repository;

import ar.edu.uade.ciudadanos.evento.document.EventoProcesado;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EventoProcesadoRepository extends MongoRepository<EventoProcesado, String> {

    /** existsById(eventId) alcanza para el chequeo de idempotencia. */
    List<EventoProcesado> findByConsumerId(String consumerId);
}
