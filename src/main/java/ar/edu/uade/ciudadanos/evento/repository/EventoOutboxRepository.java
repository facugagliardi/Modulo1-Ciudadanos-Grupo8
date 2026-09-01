package ar.edu.uade.ciudadanos.evento.repository;

import ar.edu.uade.ciudadanos.evento.document.EventoOutbox;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EventoOutboxRepository extends MongoRepository<EventoOutbox, String> {

    /** Cola de publicacion: lo pendiente, mas viejo primero. */
    List<EventoOutbox> findByPublicadoFalse(Sort sort);

    List<EventoOutbox> findByEventType(String eventType);

    /** Historial de una entidad, p.ej. todos los eventos de citizens/42. */
    List<EventoOutbox> findByAggregateTypeAndAggregateId(String aggregateType, String aggregateId);
}
