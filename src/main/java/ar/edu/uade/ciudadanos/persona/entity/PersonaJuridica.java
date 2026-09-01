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
 * Persona juridica. Comparte PK con {@link Persona}.
 *
 * <p>{@code razonSocial} y {@code estado} no estan en el diagrama pero los
 * devuelve {@code POST /auth/register} (RF-02). {@code nombre} es el del
 * diagrama y se usa como nombre de fantasia, igual que en {@code Organizacion}.
 */
@Entity
@Table(name = "persona_juridica")
public class PersonaJuridica {

    @Id
    @Column(name = "persona_id")
    private Long id;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "persona_id")
    private Persona persona;

    @Column(name = "razon_social", nullable = false, length = 255)
    private String razonSocial;

    /** Nombre de fantasia. */
    @Column(name = "nombre", nullable = false, length = 50)
    private String nombre;

    /**
     * Fecha de constitucion. El diagrama la marca NOT NULL, pero el alta por
     * {@code /auth/register} no la pide: queda opcional (ver README).
     */
    @Column(name = "fecha_de_creacion")
    private LocalDate fechaDeCreacion;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 50)
    private EstadoCiudadano estado = EstadoCiudadano.ACTIVO;

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

    public String getRazonSocial() {
        return razonSocial;
    }

    public void setRazonSocial(String razonSocial) {
        this.razonSocial = razonSocial;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public LocalDate getFechaDeCreacion() {
        return fechaDeCreacion;
    }

    public void setFechaDeCreacion(LocalDate fechaDeCreacion) {
        this.fechaDeCreacion = fechaDeCreacion;
    }

    public EstadoCiudadano getEstado() {
        return estado;
    }

    public void setEstado(EstadoCiudadano estado) {
        this.estado = estado;
    }
}
