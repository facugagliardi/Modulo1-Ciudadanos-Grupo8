package ar.edu.uade.ciudadanos.persona.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import ar.edu.uade.ciudadanos.persona.state.CiudadanoState;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Persona fisica/ciudadano. Entidad raiz para todas las interacciones de los usuarios individuales.
 */
@Entity
@Table(name = "ciudadano")
public class Ciudadano {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ciudadano_id")
    private Long id;

    @Column(name = "uuid", nullable = false, unique = true)
    private UUID uuid = UUID.randomUUID();

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

    @Transient
    private CiudadanoState state;

    @Column(name = "cuit", nullable = false, unique = true)
    private Long cuit;

    @Column(name = "creado_en", nullable = false)
    private OffsetDateTime creadoEn = OffsetDateTime.now();


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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
        this.state = estado != null ? CiudadanoState.de(estado) : null;
    }

    public CiudadanoState getState() {
        if (this.state == null || this.state.getEstado() != this.estado) {
            this.state = CiudadanoState.de(this.estado);
        }
        return this.state;
    }

    /**
     * Aplica el patron State (GoF) delegando en el estado actual la validacion y transicion.
     */
    public void cambiarEstado(EstadoCiudadano nuevoEstado) {
        CiudadanoState proximo = getState().cambiarEstado(nuevoEstado);
        this.estado = proximo.getEstado();
        this.state = proximo;
    }

    public Long getCuit() {
        return cuit;
    }

    public void setCuit(Long cuit) {
        this.cuit = cuit;
    }

    public OffsetDateTime getCreadoEn() {
        return creadoEn;
    }

    public void setCreadoEn(OffsetDateTime creadoEn) {
        this.creadoEn = creadoEn;
    }

    @PrePersist
    public void asegurarUuid() {
        if (this.uuid == null) {
            this.uuid = UUID.randomUUID();
        }
    }

    public UUID getUuid() {
        return uuid;
    }

    public void setUuid(UUID uuid) {
        this.uuid = uuid;
    }
}
