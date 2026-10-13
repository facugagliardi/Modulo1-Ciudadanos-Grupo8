package ar.edu.uade.ciudadanos.evento.entity;

/**
 * Tipo o direccion del evento:
 * EMITIDO = evento originado en M1 que sale hacia otros modulos.
 * RECIBIDO = evento entrante desde otro modulo consumido por M1.
 */
public enum TipoEvento {
    EMITIDO,
    RECIBIDO
}
