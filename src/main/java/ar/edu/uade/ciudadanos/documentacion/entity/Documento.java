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

/**
 * Documento cargado por/para una persona (RF-23..26).
 *
 * <p>{@code urlArchivo}, {@code fechaCreacion}, {@code resultadoValidacion} y
 * {@code fechaValidacion} se agregan sobre el ERD porque los devuelven los
 * endpoints de documentacion.
 */
@Entity
@Table(name = "documento")
public class Documento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "documento_id")
    private Long documentoId;

    @Column(name = "persona_id", nullable = false)
    private Long personaId;

    /** DNI, ESTATUTO, PODER, CONSTANCIA_CUIT, ... */
    @Column(name = "tipo_documento", nullable = false, length = 100)
    private String tipoDocumento;

    /** RF-24: se incrementa en cada POST /documentos/{id}/version. */
    @Column(name = "version", nullable = false)
    private Integer version = 1;

    /** RF-25. */
    @Column(name = "vigencia_hasta")
    private LocalDate vigenciaHasta;

    @Column(name = "cargado_por", nullable = false, length = 255)
    private String cargadoPor;

    @Column(name = "validado_por", length = 255)
    private String validadoPor;

    @Column(name = "url_archivo", length = 500)
    private String urlArchivo;

    @Enumerated(EnumType.STRING)
    @Column(name = "resultado_validacion", nullable = false, length = 50)
    private ResultadoValidacion resultadoValidacion = ResultadoValidacion.PENDIENTE;

    @Column(name = "fecha_validacion")
    private OffsetDateTime fechaValidacion;

    @Column(name = "fecha_creacion", nullable = false)
    private OffsetDateTime fechaCreacion = OffsetDateTime.now();

    public Long getDocumentoId() {
        return documentoId;
    }

    public void setDocumentoId(Long documentoId) {
        this.documentoId = documentoId;
    }

    public Long getPersonaId() {
        return personaId;
    }

    public void setPersonaId(Long personaId) {
        this.personaId = personaId;
    }

    public String getTipoDocumento() {
        return tipoDocumento;
    }

    public void setTipoDocumento(String tipoDocumento) {
        this.tipoDocumento = tipoDocumento;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public LocalDate getVigenciaHasta() {
        return vigenciaHasta;
    }

    public void setVigenciaHasta(LocalDate vigenciaHasta) {
        this.vigenciaHasta = vigenciaHasta;
    }

    public String getCargadoPor() {
        return cargadoPor;
    }

    public void setCargadoPor(String cargadoPor) {
        this.cargadoPor = cargadoPor;
    }

    public String getValidadoPor() {
        return validadoPor;
    }

    public void setValidadoPor(String validadoPor) {
        this.validadoPor = validadoPor;
    }

    public String getUrlArchivo() {
        return urlArchivo;
    }

    public void setUrlArchivo(String urlArchivo) {
        this.urlArchivo = urlArchivo;
    }

    public ResultadoValidacion getResultadoValidacion() {
        return resultadoValidacion;
    }

    public void setResultadoValidacion(ResultadoValidacion resultadoValidacion) {
        this.resultadoValidacion = resultadoValidacion;
    }

    public OffsetDateTime getFechaValidacion() {
        return fechaValidacion;
    }

    public void setFechaValidacion(OffsetDateTime fechaValidacion) {
        this.fechaValidacion = fechaValidacion;
    }

    public OffsetDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(OffsetDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }
}
