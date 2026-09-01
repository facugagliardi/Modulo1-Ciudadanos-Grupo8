package ar.edu.uade.ciudadanos.contacto.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** PK compuesta de {@link ContactoPersona}. */
@Embeddable
public class ContactoPersonaId implements Serializable {

    @Column(name = "ciudadano_id")
    private Long ciudadanoId;

    @Column(name = "contacto_id")
    private Long contactoId;

    public ContactoPersonaId() {
    }

    public ContactoPersonaId(Long ciudadanoId, Long contactoId) {
        this.ciudadanoId = ciudadanoId;
        this.contactoId = contactoId;
    }

    public Long getCiudadanoId() {
        return ciudadanoId;
    }

    public void setCiudadanoId(Long ciudadanoId) {
        this.ciudadanoId = ciudadanoId;
    }

    public Long getContactoId() {
        return contactoId;
    }

    public void setContactoId(Long contactoId) {
        this.contactoId = contactoId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ContactoPersonaId other)) {
            return false;
        }
        return Objects.equals(ciudadanoId, other.ciudadanoId) && Objects.equals(contactoId, other.contactoId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(ciudadanoId, contactoId);
    }
}
