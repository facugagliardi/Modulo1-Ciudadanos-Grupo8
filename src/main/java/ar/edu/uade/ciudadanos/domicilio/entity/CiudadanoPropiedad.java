package ar.edu.uade.ciudadanos.domicilio.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

/** Vinculo entre un ciudadano y una propiedad (RF-09..12). */
@Entity
@Table(name = "ciudadanos_propiedades")
public class CiudadanoPropiedad {

    @EmbeddedId
    private CiudadanoPropiedadId id;

    @Column(name = "vigente_desde", nullable = false)
    private LocalDate vigenteDesde = LocalDate.now();

    @Column(name = "vigente_hasta")
    private LocalDate vigenteHasta;

    @Column(name = "es_principal", nullable = false)
    private boolean esPrincipal;

    public CiudadanoPropiedadId getId() {
        return id;
    }

    public void setId(CiudadanoPropiedadId id) {
        this.id = id;
    }

    public LocalDate getVigenteDesde() {
        return vigenteDesde;
    }

    public void setVigenteDesde(LocalDate vigenteDesde) {
        this.vigenteDesde = vigenteDesde;
    }

    public LocalDate getVigenteHasta() {
        return vigenteHasta;
    }

    public void setVigenteHasta(LocalDate vigenteHasta) {
        this.vigenteHasta = vigenteHasta;
    }

    public boolean isEsPrincipal() {
        return esPrincipal;
    }

    public void setEsPrincipal(boolean esPrincipal) {
        this.esPrincipal = esPrincipal;
    }
}
