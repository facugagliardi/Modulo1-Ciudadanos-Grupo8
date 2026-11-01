package ar.edu.uade.ciudadanos.organizacion;

import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.domicilio.DomicilioService;
import ar.edu.uade.ciudadanos.domicilio.entity.Propiedad;
import ar.edu.uade.ciudadanos.domicilio.repository.PropiedadRepository;
import ar.edu.uade.ciudadanos.organizacion.dto.*;
import ar.edu.uade.ciudadanos.organizacion.entity.*;
import ar.edu.uade.ciudadanos.organizacion.repository.*;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.persona.dto.DatosPersona;
import ar.edu.uade.ciudadanos.security.*;
import ar.edu.uade.ciudadanos.evento.EventPublisherService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OrganizacionReglasTest {
    final OrganizacionRepository repo = mock(OrganizacionRepository.class);
    final CiudadanoOrganizacionRepository duenos = mock(CiudadanoOrganizacionRepository.class);
    final RepresentacionRepository poderes = mock(RepresentacionRepository.class);
    final CiudadanoDirectorioService directorio = mock(CiudadanoDirectorioService.class);
    final DomicilioService domicilios = mock(DomicilioService.class);
    final AutorizacionService auth = mock(AutorizacionService.class);
    final OrganizacionPropiedadRepository vinculos = mock(OrganizacionPropiedadRepository.class);
    final PropiedadRepository propiedades = mock(PropiedadRepository.class);
    final EventPublisherService eventos = mock(EventPublisherService.class);
    final OrganizacionService service = new OrganizacionService(repo, duenos, poderes, directorio, domicilios, auth, eventos, vinculos, propiedades);
    Organizacion org;

    @BeforeEach void preparar() {
        org = new Organizacion(); org.setOrganizacionId(10L); org.setCuit(30712345678L);
        org.setTaxId("TAX"); org.setRazonSocial("Empresa"); org.setEstado(EstadoOrganizacion.PENDIENTE);
        when(repo.findById(10L)).thenReturn(Optional.of(org));
        when(repo.save(any())).thenAnswer(inv -> { Organizacion o = inv.getArgument(0); o.setOrganizacionId(10L); return o; });
        when(directorio.resolver(anyLong())).thenAnswer(inv -> new DatosPersona(inv.getArgument(0), "123", "Ana", "Perez", "20111222119"));
    }

    @Test void aprobarRechazarYFiltrarPendientes() {
        var activa = new Organizacion(); activa.setEstado(EstadoOrganizacion.ACTIVA);
        when(repo.findAll()).thenReturn(List.of(org, activa));
        assertEquals(1, service.listarPendientes().size());
        assertEquals(2, service.listar().size());
        assertEquals(EstadoOrganizacion.ACTIVA, service.aprobar(10L).estado());
        verify(eventos).publicarOrganizationRegistered(eq(10L), argThat(d -> d.status().equals("ACTIVA")
                && d.organizationId().equals(10L) && d.legalName().equals("Empresa")));
        assertThrows(ApiException.class, () -> service.aprobar(10L));
        assertThrows(ApiException.class, () -> service.rechazar(10L));
        org.setEstado(EstadoOrganizacion.PENDIENTE);
        assertEquals(EstadoOrganizacion.RECHAZADA, service.rechazar(10L).estado());
        verify(auth).exigir(Permiso.CAMBIAR_ESTADO_TITULAR, "listar organizaciones pendientes");
    }

    @Test void actualizarSoloCamposPresentesYEstadosValidos() {
        var r = service.actualizar(10L, new ActualizarOrganizacionRequest(" Nueva ", "Fantasia", " srl "));
        assertEquals("Nueva", r.razonSocial()); assertEquals("Fantasia", r.nombreFantasia()); assertEquals("SRL", r.tipo());
        assertEquals("Nueva", service.actualizar(10L, new ActualizarOrganizacionRequest(null, null, null)).razonSocial());
        verify(auth, times(2)).exigirEscrituraSobreOrganizacion(10L);
        org.setEstado(EstadoOrganizacion.ACTIVA);
        service.cambiarEstado(10L, EstadoOrganizacion.INACTIVA);
        assertEquals(EstadoOrganizacion.INACTIVA, org.getEstado());
        assertThrows(ApiException.class, () -> service.cambiarEstado(10L, EstadoOrganizacion.INACTIVA));
        assertThrows(ApiException.class, () -> service.obtener(99L));
        assertThrows(ApiException.class, () -> service.actualizar(10L, new ActualizarOrganizacionRequest(null, null, "INVENTADO")));
    }

    @Test void buscarCuitNormalizaYSinExistenciaNoDa404() {
        assertFalse(service.buscarPorCuit("30-71234567-8").existe());
        when(repo.findByCuit(30712345678L)).thenReturn(Optional.of(org));
        assertEquals(10L, service.buscarPorCuit("30-71234567-8").organizacionId());
        assertEquals("Empresa", service.identidad(10L).razonSocial());
        assertThrows(ApiException.class, () -> service.buscarPorCuit(null));
        assertThrows(ApiException.class, () -> service.buscarPorCuit("123"));
    }

    @Test void listaPorDuenoOmiteVinculosSinOrganizacion() {
        assertTrue(service.listarPorDueno(1L).isEmpty());
        when(duenos.findByIdIdCiudadano(1L)).thenReturn(List.of(dueno(1, 40), duenoDe(1, 99, null)));
        when(repo.findAllById(any())).thenReturn(List.of(org));
        var r = service.listarPorDueno(1L);
        assertEquals(1, r.size());
        verify(auth, times(2)).exigirLecturaDePersona(1L);
    }

    @Test void agregarYActualizarDuenoRespetanSuma100() {
        var previo = dueno(1, 100);
        when(duenos.findByIdIdOrganizacion(10L)).thenReturn(List.of(previo));
        when(duenos.findById(new CiudadanoOrganizacionId(1L, 10L))).thenReturn(Optional.of(previo));
        var r = service.agregarDueno(10L, new AgregarDuenoRequest(2L, bd(40), List.of(new AjusteDuenoRequest(1L, bd(60)))));
        assertEquals(bd(40), r.porcentajeTitularidad()); assertEquals(bd(60), previo.getPorcentajeTitularidad());
        verify(duenos).save(argThat(d -> d.getId().getIdCiudadano().equals(2L) && bd(40).compareTo(d.getPorcentajeTitularidad()) == 0));
        assertThrows(ApiException.class, () -> service.agregarDueno(10L, new AgregarDuenoRequest(3L, bd(41))));
        var actualizado = service.actualizarDueno(10L, 1L, new ActualizarDuenoRequest(bd(100)));
        assertEquals(bd(100), actualizado.porcentajeTitularidad());
        assertEquals(1, service.listarDuenos(10L).size());
        assertThrows(ApiException.class, () -> service.actualizarDueno(10L, 99L, new ActualizarDuenoRequest(bd(10))));
    }

    @Test void duplicadoAjusteInexistenteYPorcentajeNoInformado() {
        when(duenos.existsById(new CiudadanoOrganizacionId(2L, 10L))).thenReturn(true);
        assertThrows(ApiException.class, () -> service.agregarDueno(10L, new AgregarDuenoRequest(2L, bd(10))));
        assertThrows(ApiException.class, () -> service.agregarDueno(10L, new AgregarDuenoRequest(3L, bd(10), List.of(new AjusteDuenoRequest(99L, bd(5))))));
        service.agregarDueno(10L, new AgregarDuenoRequest(3L, null));
        verify(duenos).save(argThat(d -> d.getId().getIdCiudadano().equals(3L) && d.getPorcentajeTitularidad() == null));
    }

    @Test void noSePuedeQuitarUnicoDuenoNiInexistente() {
        var a = dueno(1, 100);
        when(duenos.findById(a.getId())).thenReturn(Optional.of(a));
        when(duenos.findByIdIdOrganizacion(10L)).thenReturn(List.of(a));
        assertThrows(ApiException.class, () -> service.quitarDueno(10L, 1L, null));
        assertThrows(ApiException.class, () -> service.quitarDueno(10L, 99L, null));
        verify(duenos, never()).deleteById(any());
    }

    @ParameterizedTest @ValueSource(booleans = {true, false})
    void quitarDuenoTransfiereOReparte(boolean beneficiario) {
        var a = dueno(1, 40); var b = dueno(2, 60);
        when(duenos.findById(a.getId())).thenReturn(Optional.of(a));
        when(duenos.findById(b.getId())).thenReturn(Optional.of(b));
        when(duenos.findByIdIdOrganizacion(10L)).thenReturn(List.of(a,b));
        service.quitarDueno(10L, 1L, beneficiario ? 2L : null);
        assertEquals(0, bd(100).compareTo(b.getPorcentajeTitularidad()));
        verify(duenos).save(b); verify(duenos).deleteById(a.getId());
    }

    @Test void quitarConPorcentajeNuloYBeneficiarioSinPorcentaje() {
        var a = dueno(1, 40); var b = duenoDe(2, 10, null);
        when(duenos.findById(a.getId())).thenReturn(Optional.of(a));
        when(duenos.findById(b.getId())).thenReturn(Optional.of(b));
        when(duenos.findByIdIdOrganizacion(10L)).thenReturn(List.of(a,b));
        assertThrows(ApiException.class, () -> service.quitarDueno(10L, 1L, 99L));
        service.quitarDueno(10L, 1L, 2L);
        assertEquals(bd(40), b.getPorcentajeTitularidad());
        a.setPorcentajeTitularidad(null);
        service.quitarDueno(10L, 1L, null);
        verify(duenos, times(2)).deleteById(a.getId());
    }

    @Test void domiciliosListadosOrdenadosYPrincipal() {
        var p = propiedad(1); var q = propiedad(2);
        var a = vinculo(1, false); var b = vinculo(2, true); var perdido = vinculo(99, false);
        when(vinculos.findByIdIdOrganizacion(10L)).thenReturn(List.of(a, b, perdido));
        when(vinculos.findByIdIdOrganizacionAndEsPrincipalTrueAndVigenteHastaIsNull(10L)).thenReturn(Optional.of(b));
        var listado = service.listarDomicilios(10L);
        assertEquals(2, listado.size()); assertEquals(2L, listado.getFirst().propiedadId());
        assertEquals(2L, service.obtener(10L).domicilioPrincipal().propiedadId());
        assertEquals("calle2", listado.getFirst().calle());
        verify(auth, times(2)).exigirLecturaSobreOrganizacion(10L);
        when(vinculos.findByIdIdOrganizacionAndEsPrincipalTrueAndVigenteHastaIsNull(10L)).thenReturn(Optional.of(perdido));
        assertNull(service.obtener(10L).domicilioPrincipal());
    }

    @Test void marcarPrincipalReemplazaAnteriorYRechazaBaja() {
        var a = vinculo(1, false); var b = vinculo(2, true);
        when(vinculos.findByIdIdOrganizacionAndEsPrincipalTrueAndVigenteHastaIsNull(10L)).thenReturn(Optional.of(b));
        service.marcarDomicilioPrincipal(10L, 1L);
        assertTrue(a.isEsPrincipal()); assertFalse(b.isEsPrincipal());
        verify(vinculos).flush();
        service.marcarDomicilioPrincipal(10L, 1L);
        verify(vinculos, times(1)).save(a);
        a.setVigenteHasta(LocalDate.now());
        assertThrows(ApiException.class, () -> service.marcarDomicilioPrincipal(10L, 1L));
        assertThrows(ApiException.class, () -> service.marcarDomicilioPrincipal(10L, 99L));
    }

    @Test void bajaPrincipalEligeOtroVigenteYEsIdempotente() {
        var a = vinculo(1, true); var b = vinculo(2, false); var viejo = vinculo(3, false); viejo.setVigenteHasta(LocalDate.now().minusDays(1));
        when(vinculos.findByIdIdOrganizacion(10L)).thenReturn(List.of(a, viejo, b));
        var r = service.darDeBajaDomicilio(10L, 1L);
        assertEquals(2L, r.nuevoPrincipalId()); assertTrue(b.isEsPrincipal()); assertFalse(a.isEsPrincipal());
        assertEquals(LocalDate.now(), a.getVigenteHasta());
        service.darDeBajaDomicilio(10L, 1L);
        verify(vinculos, times(1)).save(a);
        assertThrows(ApiException.class, () -> service.darDeBajaDomicilio(10L, 99L));
    }

    @Test void bajaSinReemplazoYNoPrincipal() {
        var a = vinculo(1, true);
        when(vinculos.findByIdIdOrganizacion(10L)).thenReturn(List.of(a));
        assertNull(service.darDeBajaDomicilio(10L, 1L).nuevoPrincipalId());
        var b = vinculo(2, false);
        assertNull(service.darDeBajaDomicilio(10L, 2L).nuevoPrincipalId());
        assertEquals(LocalDate.now(), b.getVigenteHasta());
    }

    @Test void crearDomicilioNuevoNormalizaYDesmarcaAnterior() {
        var previo = vinculo(2, true);
        when(vinculos.findByIdIdOrganizacionAndEsPrincipalTrueAndVigenteHastaIsNull(10L)).thenReturn(Optional.of(previo));
        when(propiedades.save(any())).thenAnswer(inv -> { Propiedad p = inv.getArgument(0); p.setPropiedadId(1L); return p; });
        var r = service.agregarDomicilio(10L, new CrearDomicilioOrganizacionRequest(null," local "," Calle "," 123 "," 2 ",null,"1","2",true));
        assertEquals("Calle", r.calle()); assertEquals("LOCAL", r.tipo()); assertTrue(r.esPrincipal());
        assertFalse(previo.isEsPrincipal());
        verify(propiedades).save(argThat(p -> p.getPiso().equals("2") && p.getLongitud().equals("1") && p.getLatitud().equals("2")));
        verify(vinculos).flush();
    }

    @ParameterizedTest @CsvSource({"'',Calle,1", "LOCAL,'',1", "LOCAL,Calle,''"})
    void nuevaPropiedadExigeDatos(String tipo, String calle, String numero) {
        assertThrows(ApiException.class, () -> service.agregarDomicilio(10L, new CrearDomicilioOrganizacionRequest(null,tipo,calle,numero,null,null,null,null,false)));
        verify(propiedades, never()).save(any());
    }

    @Test void vinculaExistenteReabreBajaYRechazaDuplicado() {
        propiedad(1); var previo = vinculo(1, false);
        var request = new CrearDomicilioOrganizacionRequest(1L,null,null,null,null,null,null,null,false);
        assertThrows(ApiException.class, () -> service.agregarDomicilio(10L, request));
        previo.setVigenteHasta(LocalDate.now().minusDays(1));
        assertTrue(service.agregarDomicilio(10L, request).esPrincipal());
        assertNull(previo.getVigenteHasta()); assertEquals(LocalDate.now(), previo.getVigenteDesde());
        assertThrows(ApiException.class, () -> service.agregarDomicilio(10L, new CrearDomicilioOrganizacionRequest(99L,null,null,null,null,null,null,null,false)));
    }

    @Test void permisosDenegadosNoMutanOrganizacionNiPropiedades() {
        doThrow(ApiException.prohibido("ajeno")).when(auth).exigirEscrituraSobreOrganizacion(10L);
        assertThrows(ApiException.class, () -> service.actualizar(10L,new ActualizarOrganizacionRequest("Otra",null,null)));
        assertEquals("Empresa",org.getRazonSocial());
        assertThrows(ApiException.class, () -> service.darDeBajaDomicilio(10L,1L));
        verifyNoInteractions(propiedades,vinculos);
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings={" "})
    void creadorUnicoRecibeCienPorCientoYTipoPorDefecto(String tipo) {
        var r=service.crear(1L,new CrearOrganizacionRequest("30-71234567-8"," Empresa ","Fantasia",tipo,null,null,null,null));
        assertEquals("30712345678",r.cuit()); assertEquals("30712345678",r.taxId());
        assertEquals("Empresa",r.razonSocial()); assertEquals("OTRO",r.tipo()); assertEquals(EstadoOrganizacion.PENDIENTE,r.estado());
        verify(duenos).save(argThat(d->d.getId().getIdCiudadano().equals(1L)&&bd(100).compareTo(d.getPorcentajeTitularidad()) == 0));
        verify(eventos).publicarOrganizationRegistered(eq(10L),any());
    }

    @Test void crearConListaExplicitaValidaDuenosYTotal() {
        var iniciales=List.of(new DuenoInicialRequest(1L,null,bd(60)),new DuenoInicialRequest(null,2L,bd(40)));
        var r=service.crear((AuthPrincipal)null,new CrearOrganizacionRequest("30712345678","Empresa",null,"SRL"," TAX ",null,null,iniciales));
        assertEquals("TAX",r.taxId()); assertEquals("SRL",r.tipo());
        verify(duenos,times(2)).save(any()); verify(directorio).exigirQueExista(2L);
        assertThrows(ApiException.class,()->service.crear(1L,new CrearOrganizacionRequest("30712345678","x",null,null,null,null,null,List.of(new DuenoInicialRequest(1L,null,bd(101))))));
        assertThrows(ApiException.class,()->service.crear(1L,new CrearOrganizacionRequest("30712345678","x",null,null,null,null,null,List.of(new DuenoInicialRequest(null,null,null)))));
    }

    @Test void creadorComparteRestoConOtrosYNoSeDuplica() {
        var otros=List.of(new OtroDuenoRequest(2L,null,bd(40)));
        service.crear(1L,new CrearOrganizacionRequest("30712345678","x",null,"SRL"," ",null,otros,null));
        verify(duenos).save(argThat(d->d.getId().getIdCiudadano().equals(1L)&&bd(60).compareTo(d.getPorcentajeTitularidad()) == 0));
        verify(duenos).save(argThat(d->d.getId().getIdCiudadano().equals(2L)&&bd(40).compareTo(d.getPorcentajeTitularidad()) == 0));
        assertThrows(ApiException.class,()->service.crear(1L,new CrearOrganizacionRequest("30712345678","x",null,null,null,null,List.of(new OtroDuenoRequest(1L,null,bd(20))),null)));
        assertThrows(ApiException.class,()->service.crear(1L,new CrearOrganizacionRequest("30712345678","x",null,null,null,null,List.of(new OtroDuenoRequest(null,null,null)),null)));
        assertThrows(ApiException.class,()->service.crear(1L,new CrearOrganizacionRequest("30712345678","x",null,null,null,null,List.of(new OtroDuenoRequest(2L,null,bd(101))),null)));
    }

    @Test void empleadoPuedeAsignarDuenosPeroNoQuedarSinTitular() {
        var empleado=new AuthPrincipal(9L,TipoSujeto.EMPLEADO,"ADMIN");
        assertThrows(ApiException.class,()->service.crear(empleado,new CrearOrganizacionRequest("30712345678","x",null,null,null,null,null,null)));
        service.crear(empleado,new CrearOrganizacionRequest("30712345678","x",null,null,null,null,List.of(new OtroDuenoRequest(2L,null,bd(100))),null));
        verify(duenos).save(argThat(d->d.getId().getIdCiudadano().equals(2L)));
        verify(duenos,never()).save(argThat(d->d.getId().getIdCiudadano().equals(9L)));
    }

    @Test void duplicadosCuitYTaxIdSeRechazanAntesDePersistir() {
        var req=new CrearOrganizacionRequest("30712345678","x",null,null,"TAX",null,null,null);
        when(repo.existsByCuit(30712345678L)).thenReturn(true);
        assertThrows(ApiException.class,()->service.crear(1L,req));
        when(repo.existsByCuit(30712345678L)).thenReturn(false);
        when(repo.existsByTaxId("TAX")).thenReturn(true);
        assertThrows(ApiException.class,()->service.crear(1L,req));
        verify(repo,never()).save(any());
    }

    private CiudadanoOrganizacion dueno(long id, int pct) { return duenoDe(id,10,bd(pct)); }
    private CiudadanoOrganizacion duenoDe(long id,long orgId,BigDecimal pct) { var d = new CiudadanoOrganizacion(); d.setId(new CiudadanoOrganizacionId(id,orgId)); d.setPorcentajeTitularidad(pct); return d; }
    private static BigDecimal bd(int n) { return BigDecimal.valueOf(n); }
    private Propiedad propiedad(long id) { var p = new Propiedad(); p.setPropiedadId(id); p.setCalle("calle"+id); p.setTipo("LOCAL"); when(propiedades.findById(id)).thenReturn(Optional.of(p)); return p; }
    private OrganizacionPropiedad vinculo(long id,boolean principal) { var v = new OrganizacionPropiedad(); v.setId(new OrganizacionPropiedadId(10L,id)); v.setVigenteDesde(LocalDate.now()); v.setEsPrincipal(principal); when(vinculos.findByIdIdOrganizacionAndIdIdPropiedad(10L,id)).thenReturn(Optional.of(v)); return v; }
}


