package ar.edu.uade.ciudadanos.domicilio.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Vinculo persona-domicilio con vigencia (RF-09..12). La baja cierra
 * {@code vigenteHasta}; nunca se borra la fila, para conservar el historial.
 */
@Entity
@Table(name = "personas_propiedades")
public class PersonaPropiedad {

    @EmbeddedId
    private PersonaPropiedadId id;

    @Column(name = "vigente_desde", nullable = false)
    private LocalDate vigenteDesde = LocalDate.now();

    /** null = vigente. */
    @Column(name = "vigente_hasta")
    private LocalDate vigenteHasta;

    /** Agregado sobre el ERD: RF-10 pide marcar el domicilio principal. */
    @Column(name = "es_principal", nullable = false)
    private boolean esPrincipal;

    public PersonaPropiedadId getId() {
        return id;
    }

    public void setId(PersonaPropiedadId id) {
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
