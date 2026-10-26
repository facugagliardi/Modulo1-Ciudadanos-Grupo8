package ar.edu.uade.ciudadanos.organizacion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class OrganizacionPropiedadId implements Serializable {

    @Column(name = "id_organizacion")
    private Long idOrganizacion;

    @Column(name = "id_propiedad")
    private Long idPropiedad;

    public OrganizacionPropiedadId() {
    }

    public OrganizacionPropiedadId(Long idOrganizacion, Long idPropiedad) {
        this.idOrganizacion = idOrganizacion;
        this.idPropiedad = idPropiedad;
    }

    public Long getIdOrganizacion() {
        return idOrganizacion;
    }

    public void setIdOrganizacion(Long idOrganizacion) {
        this.idOrganizacion = idOrganizacion;
    }

    public Long getIdPropiedad() {
        return idPropiedad;
    }

    public void setIdPropiedad(Long idPropiedad) {
        this.idPropiedad = idPropiedad;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof OrganizacionPropiedadId that)) return false;
        return Objects.equals(idOrganizacion, that.idOrganizacion) &&
                Objects.equals(idPropiedad, that.idPropiedad);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idOrganizacion, idPropiedad);
    }
}
