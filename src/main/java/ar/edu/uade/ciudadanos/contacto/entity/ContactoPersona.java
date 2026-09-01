package ar.edu.uade.ciudadanos.contacto.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Tabla puente {@code contacto_persona} del ERD. */
@Entity
@Table(name = "contacto_persona")
public class ContactoPersona {

    @EmbeddedId
    private ContactoPersonaId id;

    public ContactoPersona() {
    }

    public ContactoPersona(ContactoPersonaId id) {
        this.id = id;
    }

    public ContactoPersonaId getId() {
        return id;
    }

    public void setId(ContactoPersonaId id) {
        this.id = id;
    }
}
