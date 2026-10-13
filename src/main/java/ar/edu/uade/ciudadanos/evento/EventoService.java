package ar.edu.uade.ciudadanos.evento;

import ar.edu.uade.ciudadanos.evento.entity.Evento;
import ar.edu.uade.ciudadanos.evento.entity.TipoEvento;
import ar.edu.uade.ciudadanos.evento.repository.EventoRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Servicio para persistir y consultar eventos en la tabla events de PostgreSQL,
 * reemplazando el patron outbox/procesados de MongoDB.
 */
@Service
public class EventoService {

    private final EventoRepository eventoRepository;

    public EventoService(EventoRepository eventoRepository) {
        this.eventoRepository = eventoRepository;
    }

    /**
     * Registra un evento que sale desde M1 hacia otros modulos (EMITIDO).
     */
    @Transactional
    public Evento registrarEmitido(String aggregateType, String aggregateId, String eventType, String payload) {
        String eventId = UUID.randomUUID().toString();
        Evento evento = new Evento(eventId, aggregateType, aggregateId, eventType, payload, TipoEvento.EMITIDO);
        return eventoRepository.save(evento);
    }

    /**
     * Registra un evento emitido con un eventId especifico.
     */
    @Transactional
    public Evento registrarEmitido(String eventId, String aggregateType, String aggregateId, String eventType, String payload) {
        Evento evento = new Evento(eventId, aggregateType, aggregateId, eventType, payload, TipoEvento.EMITIDO);
        return eventoRepository.save(evento);
    }

    /**
     * Registra un evento entrante que M1 consume y procesa desde otro modulo (RECIBIDO).
     * Devuelve true si se registro, o false si ya habia sido recibido (idempotencia).
     */
    @Transactional
    public boolean registrarRecibido(String eventId, String aggregateType, String aggregateId, String eventType, String payload) {
        if (eventoRepository.existsByEventId(eventId)) {
            return false;
        }
        Evento evento = new Evento(eventId, aggregateType, aggregateId, eventType, payload, TipoEvento.RECIBIDO);
        eventoRepository.save(evento);
        return true;
    }

    /**
     * Consulta si un evento ya fue procesado / recibido (chequeo de idempotencia).
     */
    @Transactional(readOnly = true)
    public boolean estaProcesado(String eventId) {
        return eventoRepository.existsByEventId(eventId);
    }

    @Transactional(readOnly = true)
    public Optional<Evento> buscarPorId(String eventId) {
        return eventoRepository.findById(eventId);
    }

    @Transactional(readOnly = true)
    public List<Evento> listarEmitidos() {
        return eventoRepository.findByType(TipoEvento.EMITIDO);
    }

    @Transactional(readOnly = true)
    public List<Evento> listarRecibidos() {
        return eventoRepository.findByType(TipoEvento.RECIBIDO);
    }

    @Transactional(readOnly = true)
    public List<Evento> listarPorEntidad(String aggregateType, String aggregateId) {
        return eventoRepository.findByAggregateTypeAndAggregateId(aggregateType, aggregateId);
    }
}
