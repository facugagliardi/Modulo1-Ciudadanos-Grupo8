package ar.edu.uade.ciudadanos.organizacion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/** Organizacion registrada en el modulo (RF-02, RF-08, RF-19). */
@Entity
@Table(name = "organizacion")
public class Organizacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "organizacion_id")
    private Long organizacionId;

    @Column(name = "tax_id", nullable = false, unique = true, length = 255)
    private String taxId;

    @Column(name = "razon_social", nullable = false, length = 255)
    private String razonSocial;

    /** Nombre de fantasia. */
    @Column(name = "nombre", length = 255)
    private String nombre;

    /** SA, SRL, ONG, COOPERATIVA, ... */
    @Column(name = "tipo", nullable = false, length = 100)
    private String tipo;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 50)
    private EstadoOrganizacion estado = EstadoOrganizacion.ACTIVA;

    /** CUIT de 11 digitos: BIGINT, no int. */
    @Column(name = "cuit", nullable = false, unique = true)
    private Long cuit;

    @Column(name = "creado_en", nullable = false)
    private OffsetDateTime creadoEn = OffsetDateTime.now();

    public Long getOrganizacionId() {
        return organizacionId;
    }

    public void setOrganizacionId(Long organizacionId) {
        this.organizacionId = organizacionId;
    }

    public String getTaxId() {
        return taxId;
    }

    public void setTaxId(String taxId) {
        this.taxId = taxId;
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

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public EstadoOrganizacion getEstado() {
        return estado;
    }

    public void setEstado(EstadoOrganizacion estado) {
        this.estado = estado;
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
}
