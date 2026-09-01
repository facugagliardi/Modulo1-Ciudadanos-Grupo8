package ar.edu.uade.ciudadanos.persona.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/** Vinculo del grupo familiar entre dos ciudadanos (RF-16..18). */
@Entity
@Table(name = "relacion")
public class Relacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "relacion_id")
    private Long relacionId;

    @Column(name = "ciudadano_id_1", nullable = false)
    private Long ciudadanoId1;

    @Column(name = "ciudadano_id_2", nullable = false)
    private Long ciudadanoId2;

    /** Rol del ciudadano 1 respecto del 2 (PADRE, CONYUGE, TUTOR, ...). */
    @Column(name = "relacion_ciudadano_1", nullable = false, length = 100)
    private String relacionCiudadano1;

    /** Rol del ciudadano 2 respecto del 1. */
    @Column(name = "relacion_ciudadano_2", nullable = false, length = 100)
    private String relacionCiudadano2;

    @Column(name = "es_responsable", nullable = false)
    private boolean esResponsable;

    @Column(name = "creado_en", nullable = false)
    private OffsetDateTime creadoEn = OffsetDateTime.now();

    public Long getRelacionId() {
        return relacionId;
    }

    public void setRelacionId(Long relacionId) {
        this.relacionId = relacionId;
    }

    public Long getCiudadanoId1() {
        return ciudadanoId1;
    }

    public void setCiudadanoId1(Long ciudadanoId1) {
        this.ciudadanoId1 = ciudadanoId1;
    }

    public Long getCiudadanoId2() {
        return ciudadanoId2;
    }

    public void setCiudadanoId2(Long ciudadanoId2) {
        this.ciudadanoId2 = ciudadanoId2;
    }

    public String getRelacionCiudadano1() {
        return relacionCiudadano1;
    }

    public void setRelacionCiudadano1(String relacionCiudadano1) {
        this.relacionCiudadano1 = relacionCiudadano1;
    }

    public String getRelacionCiudadano2() {
        return relacionCiudadano2;
    }

    public void setRelacionCiudadano2(String relacionCiudadano2) {
        this.relacionCiudadano2 = relacionCiudadano2;
    }

    public boolean isEsResponsable() {
        return esResponsable;
    }

    public void setEsResponsable(boolean esResponsable) {
        this.esResponsable = esResponsable;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }

    public void setCreadoEn(OffsetDateTime creadoEn) {
        this.creadoEn = creadoEn;
    }
}
