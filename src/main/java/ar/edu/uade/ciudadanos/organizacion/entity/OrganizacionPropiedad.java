package ar.edu.uade.ciudadanos.organizacion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "organizaciones_propiedades")
public class OrganizacionPropiedad {

    @EmbeddedId
    private OrganizacionPropiedadId id;

    @Column(name = "vigente_desde", nullable = false)
    private LocalDate vigenteDesde = LocalDate.now();

    @Column(name = "vigente_hasta")
    private LocalDate vigenteHasta;

    @Column(name = "es_principal", nullable = false)
    private boolean esPrincipal;

    public OrganizacionPropiedad() {
    }

    public OrganizacionPropiedad(OrganizacionPropiedadId id, LocalDate vigenteDesde, LocalDate vigenteHasta, boolean esPrincipal) {
        this.id = id;
        this.vigenteDesde = vigenteDesde;
        this.vigenteHasta = vigenteHasta;
        this.esPrincipal = esPrincipal;
    }

    public OrganizacionPropiedadId getId() {
        return id;
    }

    public void setId(OrganizacionPropiedadId id) {
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
