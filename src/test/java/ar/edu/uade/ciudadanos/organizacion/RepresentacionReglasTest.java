package ar.edu.uade.ciudadanos.organizacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.organizacion.dto.*;
import ar.edu.uade.ciudadanos.organizacion.entity.*;
import ar.edu.uade.ciudadanos.organizacion.repository.*;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.persona.dto.DatosPersona;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.evento.EventPublisherService;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RepresentacionReglasTest {
    final RepresentacionRepository repo=mock(RepresentacionRepository.class);
    final OrganizacionRepository orgs=mock(OrganizacionRepository.class);
    final CiudadanoDirectorioService directorio=mock(CiudadanoDirectorioService.class);
    final AutorizacionService auth=mock(AutorizacionService.class);
    final EventPublisherService eventos=mock(EventPublisherService.class);
    final RepresentacionService service=new RepresentacionService(repo,orgs,directorio,auth,eventos);
    final LocalDate hoy=LocalDate.now();
    @BeforeEach void preparar() {
        var org=new Organizacion(); org.setOrganizacionId(10L); org.setCuit(30712345678L); org.setRazonSocial("Empresa");
        when(orgs.findById(10L)).thenReturn(Optional.of(org));
        when(repo.save(any())).thenAnswer(inv->{ Representacion r=inv.getArgument(0); r.setRepresentacionId(1L); return r; });
        when(directorio.resolver(2L)).thenReturn(new DatosPersona(2L,"123","Ana","Perez","20111222119"));
    }

    @ParameterizedTest @ValueSource(booleans={true,false})
    void creaPoderConYSinVencimiento(boolean vence) {
        var r=service.crear(new CrearRepresentacionRequest(2L,10L," firma ",hoy,vence?hoy:null));
        assertEquals(EstadoRepresentacion.VIGENTE,r.estado()); assertEquals("FIRMA",r.alcance());
        verify(repo).save(argThat(v->v.getPersonaId().equals(2L)&&v.getOrganizacionId().equals(10L)&&v.getDesde().equals(hoy)&&Objects.equals(v.getHasta(),vence?hoy:null)));
        verify(auth).exigirGestionDeRepresentaciones(10L);
        verify(eventos).publicarRepresentationGranted(eq(1L),any());
    }

    @Test void rechazaFechaInvertidaDuplicadoYAlcanceInvalido() {
        assertThrows(ApiException.class,()->service.crear(new CrearRepresentacionRequest(2L,10L,"TOTAL",hoy,hoy.minusDays(1))));
        var vigente=representacion();
        when(repo.findByOrganizacionIdAndEstado(10L,EstadoRepresentacion.VIGENTE)).thenReturn(List.of(vigente));
        assertThrows(ApiException.class,()->service.crear(new CrearRepresentacionRequest(2L,10L,"TOTAL",hoy,null)));
        vigente.setPersonaId(3L);
        assertThrows(ApiException.class,()->service.crear(new CrearRepresentacionRequest(2L,10L,"INVENTADO",hoy,null)));
        verify(repo,never()).save(any());
    }

    @ParameterizedTest @CsvSource({"-1,VIGENTE,VENCIDA","0,VIGENTE,VIGENTE","1,VIGENTE,VIGENTE","-1,REVOCADA,REVOCADA"})
    void listadoInformaVencimientoEfectivoSinEscribir(int dias,EstadoRepresentacion almacenado,EstadoRepresentacion esperado) {
        var v=representacion(); v.setEstado(almacenado); v.setHasta(hoy.plusDays(dias));
        when(repo.findByOrganizacionId(10L)).thenReturn(List.of(v)); when(repo.findByPersonaId(2L)).thenReturn(List.of(v));
        assertEquals(esperado,service.listarDeOrganizacion(10L).getFirst().estado());
        assertEquals(esperado,service.listarDePersona(2L).getFirst().estado());
        assertEquals(almacenado,v.getEstado()); verify(repo,never()).save(any());
        verify(auth).exigirLecturaDePersona(2L);
    }

    @Test void sinFechaYOrganizacionAusenteEnListadoPersonal() {
        var v=representacion(); when(repo.findByPersonaId(2L)).thenReturn(List.of(v));
        when(orgs.findById(10L)).thenReturn(Optional.empty());
        var r=service.listarDePersona(2L).getFirst(); assertNull(r.razonSocial()); assertEquals(EstadoRepresentacion.VIGENTE,r.estado());
        assertThrows(ApiException.class,()->service.listarDeOrganizacion(10L));
        assertThrows(ApiException.class,()->service.cambiarEstado(99L,EstadoRepresentacion.REVOCADA));
    }

    @ParameterizedTest @EnumSource(value=EstadoRepresentacion.class,names={"VENCIDA","REVOCADA"})
    void cierraPoderSinReabrirYPublica(EstadoRepresentacion estado) {
        var v=representacion(); when(repo.findById(1L)).thenReturn(Optional.of(v));
        service.cambiarEstado(1L,estado);
        assertEquals(estado,v.getEstado()); assertEquals(hoy,v.getHasta());
        verify(auth).exigirGestionDeRepresentaciones(10L);
        verify(eventos).publicarRepresentationExpired(eq(1L),any());
        assertThrows(ApiException.class,()->service.cambiarEstado(1L,EstadoRepresentacion.VIGENTE));
    }

    @Test void cierreConFechaConservaVencimientoOriginal() {
        var v=representacion(); v.setHasta(hoy.plusDays(5)); when(repo.findById(1L)).thenReturn(Optional.of(v));
        service.cambiarEstado(1L,EstadoRepresentacion.REVOCADA); assertEquals(hoy.plusDays(5),v.getHasta());
    }

    @Test void consultaVigenciaNoDa404PeroExigeAmbosIds() {
        assertThrows(ApiException.class,()->service.consultarVigencia(null,10L));
        assertThrows(ApiException.class,()->service.consultarVigencia(2L,null));
        assertFalse(service.consultarVigencia(2L,10L).vigente());
        when(repo.findVigente(2L,10L,hoy)).thenReturn(Optional.of(representacion()));
        assertTrue(service.consultarVigencia(2L,10L).vigente());
    }

    @Test void permisoImpideCrearPoder() {
        doThrow(ApiException.prohibido("sin permiso")).when(auth).exigirGestionDeRepresentaciones(10L);
        assertThrows(ApiException.class,()->service.crear(new CrearRepresentacionRequest(2L,10L,"TOTAL",hoy,null)));
        verify(repo,never()).save(any()); verifyNoInteractions(eventos);
    }
    private Representacion representacion() { var v=new Representacion(); v.setRepresentacionId(1L); v.setPersonaId(2L); v.setOrganizacionId(10L); v.setDesde(hoy); v.setAlcance("TOTAL"); v.setEstado(EstadoRepresentacion.VIGENTE); return v; }
}
