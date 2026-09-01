package ar.edu.uade.ciudadanos.domicilio.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** PK compuesta de {@link PersonaPropiedad}. */
@Embeddable
public class PersonaPropiedadId implements Serializable {

    @Column(name = "id_persona")
    private Long idPersona;

    @Column(name = "id_propiedad")
    private Long idPropiedad;

    public PersonaPropiedadId() {
    }

    public PersonaPropiedadId(Long idPersona, Long idPropiedad) {
        this.idPersona = idPersona;
        this.idPropiedad = idPropiedad;
    }

    public Long getIdPersona() {
        return idPersona;
    }

    public void setIdPersona(Long idPersona) {
        this.idPersona = idPersona;
    }

    public Long getIdPropiedad() {
        return idPropiedad;
    }

    public void setIdPropiedad(Long idPropiedad) {
        this.idPropiedad = idPropiedad;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PersonaPropiedadId other)) {
            return false;
        }
        return Objects.equals(idPersona, other.idPersona) && Objects.equals(idPropiedad, other.idPropiedad);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idPersona, idPropiedad);
    }
}
