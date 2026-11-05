package ar.edu.uade.ciudadanos.expediente.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/** Expediente digital (RF-30..32). */
@Entity
@Table(name = "expediente")
public class Expediente {

    @Column(name = "uuid", nullable = false, unique = true)
    private java.util.UUID uuid = java.util.UUID.randomUUID();

    public java.util.UUID getUuid() { return uuid; }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "expediente_id")
    private Long expedienteId;

    @Column(name = "numero", nullable = false, unique = true, length = 100)
    private String numero;

    @Column(name = "public_works_project_id", unique = true)
    private java.util.UUID publicWorksProjectId;

    @Column(name = "estado_obra", length = 20)
    private String estadoObra;

    @Column(name = "resolucion_obra", length = 20)
    private String resolucionObra;

    @Column(name = "resumen_resolucion_obra", length = 4000)
    private String resumenResolucionObra;

    @Column(name = "resuelto_en")
    private OffsetDateTime resueltoEn;

    @Column(name = "resuelto_por", length = 200)
    private String resueltoPor;

    @Column(name = "resolucion_event_id")
    private java.util.UUID resolucionEventId;

    public String getResolucionObra() { return resolucionObra; }
    public String getResumenResolucionObra() { return resumenResolucionObra; }
    public OffsetDateTime getResueltoEn() { return resueltoEn; }
    public String getResueltoPor() { return resueltoPor; }
    public java.util.UUID getResolucionEventId() { return resolucionEventId; }

    public void registrarResolucionObra(String resultado, String resumen, String actor, java.util.UUID eventId) {
        this.resolucionObra = resultado;
        this.resumenResolucionObra = resumen;
        this.resueltoPor = actor;
        this.resueltoEn = OffsetDateTime.now();
        this.resolucionEventId = eventId;
    }

    public java.util.UUID getPublicWorksProjectId() { return publicWorksProjectId; }
    public void setPublicWorksProjectId(java.util.UUID id) { publicWorksProjectId = id; }
    public String getEstadoObra() { return estadoObra; }
    public void setEstadoObra(String estado) { estadoObra = estado; }

    /** Titular opcional: null identifica un expediente institucional. */
    @Column(name = "ciudadano_id")
    private Long ciudadanoId;

    @Column(name = "area_iniciadora", nullable = false, length = 255)
    private String areaIniciadora;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 50)
    private EstadoExpediente estado = EstadoExpediente.INICIADO;

    @Column(name = "caratula", nullable = false, length = 255)
    private String caratula;

    @Column(name = "fecha_inicio", nullable = false)
    private OffsetDateTime fechaInicio = OffsetDateTime.now();

    public Long getExpedienteId() {
        return expedienteId;
    }

    public void setExpedienteId(Long expedienteId) {
        this.expedienteId = expedienteId;
    }

    public String getNumero() {
        return numero;
    }

    public void setNumero(String numero) {
        this.numero = numero;
    }

    public Long getCiudadanoId() {
        return ciudadanoId;
    }

    public void setCiudadanoId(Long ciudadanoId) {
        this.ciudadanoId = ciudadanoId;
    }

    public String getAreaIniciadora() {
        return areaIniciadora;
    }

    public void setAreaIniciadora(String areaIniciadora) {
        this.areaIniciadora = areaIniciadora;
    }

    public EstadoExpediente getEstado() {
        return estado;
    }

    public void setEstado(EstadoExpediente estado) {
        this.estado = estado;
    }

    public String getCaratula() {
        return caratula;
    }

    public void setCaratula(String caratula) {
        this.caratula = caratula;
    }

    public OffsetDateTime getFechaInicio() {
        return fechaInicio;
    }

    public void setFechaInicio(OffsetDateTime fechaInicio) {
        this.fechaInicio = fechaInicio;
    }
}
