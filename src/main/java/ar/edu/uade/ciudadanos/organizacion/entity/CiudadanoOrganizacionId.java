package ar.edu.uade.ciudadanos.organizacion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** PK compuesta de {@link CiudadanoOrganizacion}. */
@Embeddable
public class CiudadanoOrganizacionId implements Serializable {

    @Column(name = "id_ciudadano")
    private Long idCiudadano;

    @Column(name = "id_organizacion")
    private Long idOrganizacion;

    public CiudadanoOrganizacionId() {
    }

    public CiudadanoOrganizacionId(Long idCiudadano, Long idOrganizacion) {
        this.idCiudadano = idCiudadano;
        this.idOrganizacion = idOrganizacion;
    }

    public Long getIdCiudadano() {
        return idCiudadano;
    }

    public void setIdCiudadano(Long idCiudadano) {
        this.idCiudadano = idCiudadano;
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
        if (!(o instanceof CiudadanoOrganizacionId other)) {
            return false;
        }
        return Objects.equals(idCiudadano, other.idCiudadano) && Objects.equals(idOrganizacion, other.idOrganizacion);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idCiudadano, idOrganizacion);
    }
}
