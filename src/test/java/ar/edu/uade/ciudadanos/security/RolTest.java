package ar.edu.uade.ciudadanos.security;

import static org.assertj.core.api.Assertions.assertThat;

import ar.edu.uade.ciudadanos.empleado.entity.RolEmpleado;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

/** La matriz de permisos, fijada como contrato. */
class RolTest {

    @Test
    void ciudadanosYJuridicasCompartenElRolPersona() {
        // No hay un rol por tipo de persona: el tipo viaja aparte (TipoSujeto).
        assertThat(Arrays.stream(Rol.values()).map(Enum::name))
                .doesNotContain("CIUDADANO", "PERSONA_JURIDICA")
                .contains("PERSONA");
    }

    @Test
    void personaNoTieneNingunPermisoSobreDatosAjenos() {
        assertThat(Rol.PERSONA.permisos()).isEmpty();
    }

    @Test
    void elAuditorLeeTodoYNoEscribeNada() {
        assertThat(Rol.AUDITOR.permisos()).containsExactlyInAnyOrder(
                Permiso.LEER_TERCEROS, Permiso.LISTAR_PADRON, Permiso.CONSULTA_INTERMODULO);

        assertThat(Rol.AUDITOR.tiene(Permiso.EDITAR_TERCEROS)).isFalse();
        assertThat(Rol.AUDITOR.tiene(Permiso.VALIDAR_DOCUMENTACION)).isFalse();
        assertThat(Rol.AUDITOR.tiene(Permiso.GESTIONAR_EXPEDIENTES)).isFalse();
        assertThat(Rol.AUDITOR.tiene(Permiso.CAMBIAR_ESTADO_TITULAR)).isFalse();
    }

    /** Mesa de entradas carga, administrativo ademas resuelve, responsable ademas decide. */
    @Test
    void losRolesDeEmpleadoSonUnaEscalera() {
        assertThat(Rol.ADMINISTRATIVO.permisos()).containsAll(Rol.MESA_ENTRADAS.permisos());
        assertThat(Rol.RESPONSABLE_AREA.permisos()).containsAll(Rol.ADMINISTRATIVO.permisos());

        assertThat(Rol.MESA_ENTRADAS.permisos()).isNotEqualTo(Rol.ADMINISTRATIVO.permisos());
        assertThat(Rol.ADMINISTRATIVO.permisos()).isNotEqualTo(Rol.RESPONSABLE_AREA.permisos());
    }

    @Test
    void mesaDeEntradasNoValidaDocumentacionNiBloqueaTitulares() {
        assertThat(Rol.MESA_ENTRADAS.tiene(Permiso.GESTIONAR_EXPEDIENTES)).isTrue();
        assertThat(Rol.MESA_ENTRADAS.tiene(Permiso.VALIDAR_DOCUMENTACION)).isFalse();
        assertThat(Rol.MESA_ENTRADAS.tiene(Permiso.CAMBIAR_ESTADO_TITULAR)).isFalse();
    }

    @Test
    void soloElResponsableDeAreaCambiaElEstadoDeUnTitular() {
        assertThat(Arrays.stream(Rol.values()).filter(r -> r.tiene(Permiso.CAMBIAR_ESTADO_TITULAR)))
                .containsExactly(Rol.RESPONSABLE_AREA);
    }

    /** Un modulo externo usa /identidad y /estado, no se lleva el legajo entero. */
    @Test
    void elServicioSoloAccedeALasConsultasInterModulo() {
        assertThat(Rol.SERVICIO.permisos()).containsExactly(Permiso.CONSULTA_INTERMODULO);
        assertThat(Rol.SERVICIO.tiene(Permiso.LEER_TERCEROS)).isFalse();
        assertThat(Rol.SERVICIO.tiene(Permiso.LISTAR_PADRON)).isFalse();
    }

    @Test
    void cadaRolDeEmpleadoDeLaBaseTieneSuRolDeSeguridad() {
        for (RolEmpleado rolEmpleado : RolEmpleado.values()) {
            assertThat(Rol.deEmpleado(rolEmpleado).name()).isEqualTo(rolEmpleado.name());
        }
    }

    @Test
    void unRolDesconocidoEnElTokenNoAutorizaNada() {
        assertThat(Rol.porNombre("SUPERUSUARIO")).isEmpty();
    }
}
