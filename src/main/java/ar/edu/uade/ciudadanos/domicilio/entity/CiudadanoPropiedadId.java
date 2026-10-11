package ar.edu.uade.ciudadanos.domicilio.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** PK compuesta de {@link CiudadanoPropiedad}. */
@Embeddable
public class CiudadanoPropiedadId implements Serializable {

    @Column(name = "id_ciudadano")
    private Long idCiudadano;

    @Column(name = "id_propiedad")
    private Long idPropiedad;

    public CiudadanoPropiedadId() {
    }

    public CiudadanoPropiedadId(Long idCiudadano, Long idPropiedad) {
        this.idCiudadano = idCiudadano;
        this.idPropiedad = idPropiedad;
    }

    public Long getIdCiudadano() {
        return idCiudadano;
    }

    public void setIdCiudadano(Long idCiudadano) {
        this.idCiudadano = idCiudadano;
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
        if (!(o instanceof CiudadanoPropiedadId other)) {
            return false;
        }
        return Objects.equals(idCiudadano, other.idCiudadano) && Objects.equals(idPropiedad, other.idPropiedad);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idCiudadano, idPropiedad);
    }
}
