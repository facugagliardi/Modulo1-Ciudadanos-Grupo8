package ar.edu.uade.ciudadanos.organizacion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** PK compuesta de {@link PersonaOrganizacion}. */
@Embeddable
public class PersonaOrganizacionId implements Serializable {

    @Column(name = "id_persona")
    private Long idPersona;

    @Column(name = "id_organizacion")
    private Long idOrganizacion;

    public PersonaOrganizacionId() {
    }

    public PersonaOrganizacionId(Long idPersona, Long idOrganizacion) {
        this.idPersona = idPersona;
        this.idOrganizacion = idOrganizacion;
    }

    public Long getIdPersona() {
        return idPersona;
    }

    public void setIdPersona(Long idPersona) {
        this.idPersona = idPersona;
    }

    public Long getIdOrganizacion() {
        return idOrganizacion;
    }

    public void setIdOrganizacion(Long idOrganizacion) {
        this.idOrganizacion = idOrganizacion;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PersonaOrganizacionId other)) {
            return false;
        }
        return Objects.equals(idPersona, other.idPersona) && Objects.equals(idOrganizacion, other.idOrganizacion);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idPersona, idOrganizacion);
    }
}
