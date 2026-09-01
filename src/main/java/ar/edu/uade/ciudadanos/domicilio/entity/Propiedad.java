package ar.edu.uade.ciudadanos.domicilio.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** Domicilio/propiedad fisica. Tabla {@code propiedades} del ERD. */
@Entity
@Table(name = "propiedades")
public class Propiedad {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "propiedad_id")
    private Long propiedadId;

    /** CASA, DEPARTAMENTO, LOCAL, TERRENO, ... */
    @Column(name = "tipo", nullable = false, length = 100)
    private String tipo;

    @Column(name = "calle", nullable = false, length = 255)
    private String calle;

    @Column(name = "numero", nullable = false, length = 50)
    private String numero;

    /**
     * Piso/depto o altura complementaria. El diagrama la marca NOT NULL, pero
     * POST /personas/{id}/domicilios no la recibe: queda opcional (ver README).
     */
    @Column(name = "altura", length = 50)
    private String altura;

    @Column(name = "id_barrio")
    private UUID idBarrio;

    @Column(name = "longitud", length = 50)
    private String longitud;

    @Column(name = "latitud", length = 50)
    private String latitud;

    public Long getPropiedadId() {
        return propiedadId;
    }

    public void setPropiedadId(Long propiedadId) {
        this.propiedadId = propiedadId;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getCalle() {
        return calle;
    }

    public void setCalle(String calle) {
        this.calle = calle;
    }

    public String getNumero() {
        return numero;
    }

    public void setNumero(String numero) {
        this.numero = numero;
    }

    public String getAltura() {
        return altura;
    }

    public void setAltura(String altura) {
        this.altura = altura;
    }

    public UUID getIdBarrio() {
        return idBarrio;
    }

    public void setIdBarrio(UUID idBarrio) {
        this.idBarrio = idBarrio;
    }

    public String getLongitud() {
        return longitud;
    }

    public void setLongitud(String longitud) {
        this.longitud = longitud;
    }

    public String getLatitud() {
        return latitud;
    }

    public void setLatitud(String latitud) {
        this.latitud = latitud;
    }
}
