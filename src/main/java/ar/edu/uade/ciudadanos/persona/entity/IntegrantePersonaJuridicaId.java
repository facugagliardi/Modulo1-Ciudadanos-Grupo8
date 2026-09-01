package ar.edu.uade.ciudadanos.persona.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** PK compuesta de {@link IntegrantePersonaJuridica}: el ciudadano y la juridica que integra. */
@Embeddable
public class IntegrantePersonaJuridicaId implements Serializable {

    @Column(name = "id_ciudadano")
    private Long idCiudadano;

    @Column(name = "id_persona_juridica")
    private Long idPersonaJuridica;

    public IntegrantePersonaJuridicaId() {
    }

    public IntegrantePersonaJuridicaId(Long idCiudadano, Long idPersonaJuridica) {
        this.idCiudadano = idCiudadano;
        this.idPersonaJuridica = idPersonaJuridica;
    }

    public Long getIdCiudadano() {
        return idCiudadano;
    }

    public void setIdCiudadano(Long idCiudadano) {
        this.idCiudadano = idCiudadano;
    }

    public Long getIdPersonaJuridica() {
        return idPersonaJuridica;
    }

    public void setIdPersonaJuridica(Long idPersonaJuridica) {
        this.idPersonaJuridica = idPersonaJuridica;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof IntegrantePersonaJuridicaId other)) {
            return false;
        }
        return Objects.equals(idCiudadano, other.idCiudadano)
                && Objects.equals(idPersonaJuridica, other.idPersonaJuridica);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idCiudadano, idPersonaJuridica);
    }
}
