package ar.edu.uade.ciudadanos.evento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ar.edu.uade.ciudadanos.auth.AuthService;
import ar.edu.uade.ciudadanos.auth.dto.RegisterRequest;
import ar.edu.uade.ciudadanos.auth.dto.RegisterResponse;
import ar.edu.uade.ciudadanos.contacto.repository.ContactoCiudadanoRepository;
import ar.edu.uade.ciudadanos.domicilio.DomicilioService;
import ar.edu.uade.ciudadanos.domicilio.dto.CrearDomicilioRequest;
import ar.edu.uade.ciudadanos.domicilio.dto.DomicilioCreadoResponse;
import ar.edu.uade.ciudadanos.domicilio.entity.Propiedad;
import ar.edu.uade.ciudadanos.domicilio.repository.CiudadanoPropiedadRepository;
import ar.edu.uade.ciudadanos.domicilio.repository.PropiedadRepository;
import ar.edu.uade.ciudadanos.empleado.repository.CredencialEmpleadoRepository;
import ar.edu.uade.ciudadanos.empleado.repository.CuentaEmpleadoRepository;
import ar.edu.uade.ciudadanos.expediente.ExpedienteService;
import ar.edu.uade.ciudadanos.expediente.entity.EstadoExpediente;
import ar.edu.uade.ciudadanos.expediente.entity.Expediente;
import ar.edu.uade.ciudadanos.expediente.repository.ActuacionRepository;
import ar.edu.uade.ciudadanos.expediente.repository.ExpedienteRepository;
import ar.edu.uade.ciudadanos.organizacion.OrganizacionService;
import ar.edu.uade.ciudadanos.organizacion.RepresentacionService;
import ar.edu.uade.ciudadanos.organizacion.dto.CrearOrganizacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.CrearRepresentacionRequest;
import ar.edu.uade.ciudadanos.organizacion.dto.OrganizacionResponse;
import ar.edu.uade.ciudadanos.organizacion.dto.RepresentacionResponse;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoOrganizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.EstadoRepresentacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Organizacion;
import ar.edu.uade.ciudadanos.organizacion.entity.Representacion;
import ar.edu.uade.ciudadanos.organizacion.repository.CiudadanoOrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.OrganizacionRepository;
import ar.edu.uade.ciudadanos.organizacion.repository.RepresentacionRepository;
import ar.edu.uade.ciudadanos.persona.CiudadanoDirectorioService;
import ar.edu.uade.ciudadanos.persona.CiudadanoService;
import ar.edu.uade.ciudadanos.persona.dto.ActualizarCiudadanoRequest;
import ar.edu.uade.ciudadanos.persona.dto.CambioEstadoResponse;
import ar.edu.uade.ciudadanos.persona.dto.CiudadanoResponse;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.CredencialCiudadanoRepository;
import ar.edu.uade.ciudadanos.security.AuthPrincipal;
import ar.edu.uade.ciudadanos.security.AutorizacionService;
import ar.edu.uade.ciudadanos.security.JwtProperties;
import ar.edu.uade.ciudadanos.security.JwtService;
import ar.edu.uade.ciudadanos.security.TipoSujeto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AutomaticEventTriggerTest {

    @Mock private EventPublisherService eventPublisherService;

    // Repositories & mocks for AuthService
    @Mock private CiudadanoRepository ciudadanoRepository;
    @Mock private CredencialCiudadanoRepository credencialCiudadanoRepository;
    @Mock private CuentaEmpleadoRepository cuentaEmpleadoRepository;
    @Mock private CredencialEmpleadoRepository credencialEmpleadoRepository;
    @Mock private ContactoCiudadanoRepository contactoRepository;

    // Repositories & mocks for CiudadanoService & DomicilioService
    @Mock private PropiedadRepository propiedadRepository;
    @Mock private CiudadanoPropiedadRepository vinculoRepository;
    @Mock private AutorizacionService autorizacion;
    @Mock private CiudadanoDirectorioService directorio;

    // Repositories & mocks for OrganizacionService & RepresentacionService
    @Mock private OrganizacionRepository organizacionRepository;
    @Mock private CiudadanoOrganizacionRepository duenoRepository;
    @Mock private RepresentacionRepository representacionRepository;

    // Repositories & mocks for ExpedienteService
    @Mock private ExpedienteRepository expedienteRepository;
    @Mock private ActuacionRepository actuacionRepository;

    @Test
    @DisplayName("1. Crear un ciudadano (alta en /auth/register) debe disparar automáticamente el evento citizenUpdated (REGISTERED)")
    void crearCiudadanoDisparaEventoRegistered() {
        JwtProperties props = new JwtProperties();
        props.setSecret("c2VjcmV0by1kZS1wcnVlYmEtcXVlLXN1cGVyYS1sb3MtMzItYnl0ZXMtcmVxdWVyaWRvcw==");
        AuthService authService = new AuthService(
                ciudadanoRepository, credencialCiudadanoRepository, cuentaEmpleadoRepository,
                credencialEmpleadoRepository, new BCryptPasswordEncoder(), new JwtService(props),
                contactoRepository, eventPublisherService
        );

        RegisterRequest request = new RegisterRequest(
                "20-34567890-1", "Password123!", "34567890", "Marcos", "Ferreyra",
                LocalDate.of(1990, 4, 12)
        );

        when(ciudadanoRepository.existsByCuit(20345678901L)).thenReturn(false);
        when(ciudadanoRepository.existsByDocumentoId("34567890")).thenReturn(false);
        when(ciudadanoRepository.save(any(Ciudadano.class))).thenAnswer(inv -> {
            Ciudadano c = inv.getArgument(0);
            c.setId(8452L);
            return c;
        });

        RegisterResponse response = authService.registrar(request);

        assertThat(response).isNotNull();
        // Verifica que se disparó automáticamente el evento citizenUpdated REGISTERED
        verify(eventPublisherService).publicarCitizenUpdated(
                eq(response.uuid().toString()),
                eq("REGISTERED"),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("2. Actualizar datos de un ciudadano (PUT /ciudadanos/{id}) debe disparar automáticamente citizenUpdated (UPDATED)")
    void actualizarCiudadanoDisparaEvento() {
        DomicilioService domicilioService = new DomicilioService(propiedadRepository, vinculoRepository, ciudadanoRepository, autorizacion, eventPublisherService);
        CiudadanoService ciudadanoService = new CiudadanoService(
                ciudadanoRepository, contactoRepository, domicilioService, autorizacion, eventPublisherService
        );

        Ciudadano c = new Ciudadano();
        c.setId(8452L);
        c.setCuit(20345678901L);
        c.setDocumentoId("34567890");
        c.setNombre("Marcos");
        c.setApellido("Ferreyra");
        c.setFechaNacimiento(LocalDate.of(1990, 4, 12));
        c.setEstado(EstadoCiudadano.ACTIVO);

        when(ciudadanoRepository.findById(8452L)).thenReturn(Optional.of(c));

        ActualizarCiudadanoRequest request = new ActualizarCiudadanoRequest(
                "Marcos Modificado", "Ferreyra", null, null, null
        );

        CiudadanoResponse response = ciudadanoService.actualizar(8452L, request);

        assertThat(response).isNotNull();
        verify(eventPublisherService).publicarCitizenUpdated(
                eq(c.getUuid().toString()),
                eq("UPDATED"),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("3. Bloquear un ciudadano (cambio de estado) debe disparar automáticamente citizenUpdated (BLOCKED)")
    void bloquearCiudadanoDisparaEventoBlocked() {
        DomicilioService domicilioService = new DomicilioService(propiedadRepository, vinculoRepository, ciudadanoRepository, autorizacion, eventPublisherService);
        CiudadanoService ciudadanoService = new CiudadanoService(
                ciudadanoRepository, contactoRepository, domicilioService, autorizacion, eventPublisherService
        );

        Ciudadano c = new Ciudadano();
        c.setId(8452L);
        c.setEstado(EstadoCiudadano.ACTIVO);
        when(ciudadanoRepository.findById(8452L)).thenReturn(Optional.of(c));

        CambioEstadoResponse res = ciudadanoService.cambiarEstado(8452L, EstadoCiudadano.BLOQUEADO);

        assertThat(res.estadoNuevo()).isEqualTo("BLOQUEADO");
        verify(eventPublisherService).publicarCitizenUpdated(
                eq(c.getUuid().toString()),
                eq("BLOCKED"),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("4. Crear un domicilio principal nuevo debe disparar automáticamente citizenUpdated (ADDRESS_UPDATED)")
    void crearDomicilioPrincipalDisparaEventoAddressUpdated() {
        DomicilioService domicilioService = new DomicilioService(
                propiedadRepository, vinculoRepository, ciudadanoRepository, autorizacion, eventPublisherService
        );

        Ciudadano c = new Ciudadano();
        c.setId(8452L);
        when(ciudadanoRepository.findById(8452L)).thenReturn(Optional.of(c));
        when(ciudadanoRepository.existsById(8452L)).thenReturn(true);
        when(propiedadRepository.save(any(Propiedad.class))).thenAnswer(inv -> {
            Propiedad p = inv.getArgument(0);
            p.setPropiedadId(5602L);
            return p;
        });

        CrearDomicilioRequest req = new CrearDomicilioRequest(
                "CASA", "San Martin", "870", null, null, null, null, true
        );

        DomicilioCreadoResponse res = domicilioService.crear(8452L, req);

        assertThat(res.esPrincipal()).isTrue();
        verify(eventPublisherService).publicarCitizenUpdated(
                eq(c.getUuid().toString()),
                eq("ADDRESS_UPDATED"),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("5. Crear una organización (POST /organizaciones) debe disparar automáticamente organizationRegistered")
    void crearOrganizacionDisparaEvento() {
        DomicilioService domicilioService = new DomicilioService(propiedadRepository, vinculoRepository, ciudadanoRepository, autorizacion, eventPublisherService);
        OrganizacionService organizacionService = new OrganizacionService(
                organizacionRepository, duenoRepository, representacionRepository,
                directorio, domicilioService, autorizacion, eventPublisherService
        );

        when(organizacionRepository.existsByCuit(30712345678L)).thenReturn(false);
        when(organizacionRepository.existsByTaxId("30712345678")).thenReturn(false);
        when(organizacionRepository.save(any(Organizacion.class))).thenAnswer(inv -> {
            Organizacion o = inv.getArgument(0);
            o.setOrganizacionId(3311L);
            return o;
        });

        CrearOrganizacionRequest req = new CrearOrganizacionRequest(
                "30-71234567-8", "Panaderia Del Sol S.R.L.", "Panaderia Del Sol", "SRL", "30712345678", null, List.of(), List.of()
        );

        OrganizacionResponse res = organizacionService.crear(new AuthPrincipal(8452L, TipoSujeto.CIUDADANO, "PERSONA"), req);

        assertThat(res).isNotNull();
        verify(eventPublisherService).publicarOrganizationRegistered(eq(3311L), any());
    }

    @Test
    @DisplayName("6. Otorgar representación (POST /representaciones) debe disparar automáticamente representationGranted")
    void crearRepresentacionDisparaEventoGranted() {
        RepresentacionService representacionService = new RepresentacionService(
                representacionRepository, organizacionRepository, directorio, autorizacion, eventPublisherService
        );

        Organizacion org = new Organizacion();
        org.setOrganizacionId(3311L);
        org.setCuit(30712345678L);
        when(organizacionRepository.findById(3311L)).thenReturn(Optional.of(org));

        when(representacionRepository.save(any(Representacion.class))).thenAnswer(inv -> {
            Representacion r = inv.getArgument(0);
            r.setRepresentacionId(990L);
            return r;
        });

        CrearRepresentacionRequest req = new CrearRepresentacionRequest(
                8452L, 3311L, "TOTAL", LocalDate.of(2026, 8, 21), null
        );

        RepresentacionResponse res = representacionService.crear(req);

        assertThat(res).isNotNull();
        verify(eventPublisherService).publicarRepresentationGranted(eq(990L), any());
    }

    @Test
    @DisplayName("7. Revocar o expirar representación debe disparar automáticamente representationExpired")
    void expirarRepresentacionDisparaEventoExpired() {
        RepresentacionService representacionService = new RepresentacionService(
                representacionRepository, organizacionRepository, directorio, autorizacion, eventPublisherService
        );

        Organizacion org = new Organizacion();
        org.setOrganizacionId(3311L);
        org.setCuit(30712345678L);
        when(organizacionRepository.findById(3311L)).thenReturn(Optional.of(org));

        Representacion rep = new Representacion();
        rep.setRepresentacionId(990L);
        rep.setPersonaId(8452L);
        rep.setOrganizacionId(3311L);
        rep.setEstado(EstadoRepresentacion.VIGENTE);
        when(representacionRepository.findById(990L)).thenReturn(Optional.of(rep));

        CambioEstadoResponse res = representacionService.cambiarEstado(990L, EstadoRepresentacion.REVOCADA);

        assertThat(res.estadoNuevo()).isEqualTo("REVOCADA");
        verify(eventPublisherService).publicarRepresentationExpired(eq(990L), any());
    }

    @Test
    @DisplayName("8. Resolver un expediente (estado RESUELTO) debe disparar automáticamente casefileResolved")
    void resolverExpedienteDisparaEventoResolved() {
        ExpedienteService expedienteService = new ExpedienteService(
                expedienteRepository, actuacionRepository, directorio, autorizacion, new ObjectMapper(), eventPublisherService
        );

        Expediente exp = new Expediente();
        exp.setExpedienteId(1042L);
        exp.setNumero("EXP-2026-001042");
        exp.setCiudadanoId(84L);
        exp.setAreaIniciadora("Obras Públicas");
        exp.setCaratula("Aprobación y autorización de ejecución de obra pública");
        exp.setEstado(EstadoExpediente.EN_TRAMITE);
        when(expedienteRepository.findById(1042L)).thenReturn(Optional.of(exp));

        CambioEstadoResponse res = expedienteService.cambiarEstado(1042L, EstadoExpediente.RESUELTO);

        assertThat(res.estadoNuevo()).isEqualTo("RESUELTO");
        verify(eventPublisherService).publicarCasefileResolved(any());
    }
}
