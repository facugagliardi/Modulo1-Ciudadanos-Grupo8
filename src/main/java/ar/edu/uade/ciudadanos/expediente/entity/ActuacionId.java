package ar.edu.uade.ciudadanos.expediente.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** PK compuesta de {@link Actuacion}: la actuacion se numera dentro del expediente. */
@Embeddable
public class ActuacionId implements Serializable {

    @Column(name = "expediente_id")
    private Long expedienteId;

    /** Numero de orden dentro del expediente (1, 2, 3...). */
    @Column(name = "actuacion_id")
    private Long actuacionId;

    public ActuacionId() {
    }

    public ActuacionId(Long expedienteId, Long actuacionId) {
        this.expedienteId = expedienteId;
        this.actuacionId = actuacionId;
    }

    public Long getExpedienteId() {
        return expedienteId;
    }

    public void setExpedienteId(Long expedienteId) {
        this.expedienteId = expedienteId;
    }

    public Long getActuacionId() {
        return actuacionId;
    }

    public void setActuacionId(Long actuacionId) {
        this.actuacionId = actuacionId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ActuacionId other)) {
            return false;
        }
        return Objects.equals(expedienteId, other.expedienteId) && Objects.equals(actuacionId, other.actuacionId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(expedienteId, actuacionId);
    }
}
