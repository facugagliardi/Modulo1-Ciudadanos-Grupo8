package ar.edu.uade.ciudadanos.persona.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Ciudadanos que integran una persona juridica (RF-03, RF-19).
 * Tabla puente pura: la PK son las dos FK.
 */
@Entity
@Table(name = "integrantes_personas_juridicas")
public class IntegrantePersonaJuridica {

    @EmbeddedId
    private IntegrantePersonaJuridicaId id;

    public IntegrantePersonaJuridica() {
    }

    public IntegrantePersonaJuridica(IntegrantePersonaJuridicaId id) {
        this.id = id;
    }

    public IntegrantePersonaJuridicaId getId() {
        return id;
    }

    public void setId(IntegrantePersonaJuridicaId id) {
        this.id = id;
    }
}
