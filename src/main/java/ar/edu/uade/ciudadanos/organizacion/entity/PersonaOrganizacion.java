package ar.edu.uade.ciudadanos.organizacion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Duenos/titulares de una organizacion (RF-19). */
@Entity
@Table(name = "persona_organizacion")
public class PersonaOrganizacion {

    @EmbeddedId
    private PersonaOrganizacionId id;

    /** Agregado sobre el ERD: lo devuelven los endpoints de duenos. */
    @Column(name = "porcentaje_titularidad", precision = 5, scale = 2)
    private BigDecimal porcentajeTitularidad;

    @Column(name = "asociado_en", nullable = false)
    private OffsetDateTime asociadoEn = OffsetDateTime.now();

    public PersonaOrganizacionId getId() {
        return id;
    }

    public void setId(PersonaOrganizacionId id) {
        this.id = id;
    }

    public BigDecimal getPorcentajeTitularidad() {
        return porcentajeTitularidad;
    }

    public void setPorcentajeTitularidad(BigDecimal porcentajeTitularidad) {
        this.porcentajeTitularidad = porcentajeTitularidad;
    }

    public OffsetDateTime getAsociadoEn() {
        return asociadoEn;
    }

    public void setAsociadoEn(OffsetDateTime asociadoEn) {
        this.asociadoEn = asociadoEn;
    }
}
