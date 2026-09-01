package ar.edu.uade.ciudadanos.expediente.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * Movimiento dentro de un expediente (RF-33..35).
 *
 * <p>Los campos descriptivos ({@code tipo}, {@code descripcion},
 * {@code moduloOrigen}, {@code fecha}, {@code adjuntos}) se agregan sobre el ERD
 * porque los exige {@code GET /expedientes/{id}/actuaciones}.
 */
@Entity
@Table(name = "actuacion")
public class Actuacion {

    @EmbeddedId
    private ActuacionId id;

    @Column(name = "tipo", nullable = false, length = 100)
    private String tipo;

    @Column(name = "descripcion", nullable = false, columnDefinition = "text")
    private String descripcion;

    @Column(name = "modulo_origen", nullable = false, length = 100)
    private String moduloOrigen;

    @Column(name = "fecha", nullable = false)
    private OffsetDateTime fecha = OffsetDateTime.now();

    /** RF-34: JSON serializado con las referencias externas a archivos. */
    @Column(name = "adjuntos", columnDefinition = "text")
    private String adjuntos;

    public ActuacionId getId() {
        return id;
    }

    public void setId(ActuacionId id) {
        this.id = id;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getModuloOrigen() {
        return moduloOrigen;
    }

    public void setModuloOrigen(String moduloOrigen) {
        this.moduloOrigen = moduloOrigen;
    }

    public OffsetDateTime getFecha() {
        return fecha;
    }

    public void setFecha(OffsetDateTime fecha) {
        this.fecha = fecha;
    }

    public String getAdjuntos() {
        return adjuntos;
    }

    public void setAdjuntos(String adjuntos) {
        this.adjuntos = adjuntos;
    }
}
