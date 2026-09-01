package ar.edu.uade.ciudadanos.organizacion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

/** Poder de una persona para operar en nombre de una organizacion (RF-20..22). */
@Entity
@Table(name = "representacion")
public class Representacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "representacion_id")
    private Long representacionId;

    @Column(name = "persona_id", nullable = false)
    private Long personaId;

    @Column(name = "organizacion_id", nullable = false)
    private Long organizacionId;

    /** TOTAL, TRAMITES, FIRMA, ... */
    @Column(name = "alcance", nullable = false, length = 255)
    private String alcance;

    @Column(name = "desde", nullable = false)
    private LocalDate desde;

    /** null = sin vencimiento. */
    @Column(name = "hasta")
    private LocalDate hasta;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 50)
    private EstadoRepresentacion estado = EstadoRepresentacion.VIGENTE;

    public Long getRepresentacionId() {
        return representacionId;
    }

    public void setRepresentacionId(Long representacionId) {
        this.representacionId = representacionId;
    }

    public Long getPersonaId() {
        return personaId;
    }

    public void setPersonaId(Long personaId) {
        this.personaId = personaId;
    }

    public Long getOrganizacionId() {
        return organizacionId;
    }

    public void setOrganizacionId(Long organizacionId) {
        this.organizacionId = organizacionId;
    }

    public String getAlcance() {
        return alcance;
    }

    public void setAlcance(String alcance) {
        this.alcance = alcance;
    }

    public LocalDate getDesde() {
        return desde;
    }

    public void setDesde(LocalDate desde) {
        this.desde = desde;
    }

    public LocalDate getHasta() {
        return hasta;
    }

    public void setHasta(LocalDate hasta) {
        this.hasta = hasta;
    }

    public EstadoRepresentacion getEstado() {
        return estado;
    }

    public void setEstado(EstadoRepresentacion estado) {
        this.estado = estado;
    }
}
