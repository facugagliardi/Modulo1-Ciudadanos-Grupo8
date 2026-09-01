package ar.edu.uade.ciudadanos.documentacion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Pedido de documentacion faltante a una persona u organizacion (RF-27..29). */
@Entity
@Table(name = "solicitud_documentacion")
public class SolicitudDocumentacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "solicitud_id")
    private Long solicitudId;

    @Column(name = "titular_id", nullable = false)
    private Long titularId;

    @Column(name = "tipo_documento", nullable = false, length = 100)
    private String tipoDocumento;

    /** Fecha limite para cumplir. */
    @Column(name = "plazo", nullable = false)
    private LocalDate plazo;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 50)
    private EstadoSolicitud estado = EstadoSolicitud.PENDIENTE;

    @Enumerated(EnumType.STRING)
    @Column(name = "origen", nullable = false, length = 100)
    private OrigenSolicitud origen = OrigenSolicitud.INTERNA;

    /** Documento que cumplio la solicitud; requerido para pasar a CUMPLIDA. */
    @Column(name = "documento_id")
    private Long documentoId;

    @Column(name = "creado_en", nullable = false)
    private OffsetDateTime creadoEn = OffsetDateTime.now();

    public Long getSolicitudId() {
        return solicitudId;
    }

    public void setSolicitudId(Long solicitudId) {
        this.solicitudId = solicitudId;
    }

    public Long getTitularId() {
        return titularId;
    }

    public void setTitularId(Long titularId) {
        this.titularId = titularId;
    }

    public String getTipoDocumento() {
        return tipoDocumento;
    }

    public void setTipoDocumento(String tipoDocumento) {
        this.tipoDocumento = tipoDocumento;
    }

    public LocalDate getPlazo() {
        return plazo;
    }

    public void setPlazo(LocalDate plazo) {
        this.plazo = plazo;
    }

    public EstadoSolicitud getEstado() {
        return estado;
    }

    public void setEstado(EstadoSolicitud estado) {
        this.estado = estado;
    }

    public OrigenSolicitud getOrigen() {
        return origen;
    }

    public void setOrigen(OrigenSolicitud origen) {
        this.origen = origen;
    }

    public Long getDocumentoId() {
        return documentoId;
    }

    public void setDocumentoId(Long documentoId) {
        this.documentoId = documentoId;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }

    public void setCreadoEn(OffsetDateTime creadoEn) {
        this.creadoEn = creadoEn;
    }
}
