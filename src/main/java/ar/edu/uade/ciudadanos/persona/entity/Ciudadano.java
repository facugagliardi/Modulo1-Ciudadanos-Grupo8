package ar.edu.uade.ciudadanos.persona.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Persona fisica. Comparte PK con {@link Persona}.
 *
 * <p>{@code documentoId} del diagrama es el DNI (varchar unico), no una FK a
 * {@code documento}: asi lo usan {@code GET /ciudadanos/dni/{dni}} y RF-06.
 */
@Entity
@Table(name = "ciudadano")
public class Ciudadano {

    @Id
    @Column(name = "persona_id")
    private Long id;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "persona_id")
    private Persona persona;

    /** DNI. */
    @Column(name = "documento_id", nullable = false, unique = true, length = 255)
    private String documentoId;

    @Column(name = "nombre", nullable = false, length = 255)
    private String nombre;

    @Column(name = "apellido", nullable = false, length = 255)
    private String apellido;

    @Column(name = "fecha_nacimiento", nullable = false)
    private LocalDate fechaNacimiento;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 50)
    private EstadoCiudadano estado = EstadoCiudadano.ACTIVO;

    /**
     * Domicilio principal segun el diagrama. El vinculo vigente vive en
     * {@code personas_propiedades.es_principal}; esta columna se mantiene por
     * fidelidad al ERD y queda como puntero denormalizado (ver README).
     */
    @Column(name = "domicilio_id")
    private Long domicilioId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Persona getPersona() {
        return persona;
    }

    public void setPersona(Persona persona) {
        this.persona = persona;
    }

    public String getDocumentoId() {
        return documentoId;
    }

    public void setDocumentoId(String documentoId) {
        this.documentoId = documentoId;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getApellido() {
        return apellido;
    }

    public void setApellido(String apellido) {
        this.apellido = apellido;
    }

    public LocalDate getFechaNacimiento() {
        return fechaNacimiento;
    }

    public void setFechaNacimiento(LocalDate fechaNacimiento) {
        this.fechaNacimiento = fechaNacimiento;
    }

    public EstadoCiudadano getEstado() {
        return estado;
    }

    public void setEstado(EstadoCiudadano estado) {
        this.estado = estado;
    }

    public Long getDomicilioId() {
        return domicilioId;
    }

    public void setDomicilioId(Long domicilioId) {
        this.domicilioId = domicilioId;
    }
}
