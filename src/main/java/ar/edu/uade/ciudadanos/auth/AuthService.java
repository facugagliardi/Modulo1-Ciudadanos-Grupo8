package ar.edu.uade.ciudadanos.auth;

import ar.edu.uade.ciudadanos.auth.dto.EmpleadoLoginRequest;
import ar.edu.uade.ciudadanos.auth.dto.EmpleadoLoginResponse;
import ar.edu.uade.ciudadanos.auth.dto.LoginRequest;
import ar.edu.uade.ciudadanos.auth.dto.LoginResponse;
import ar.edu.uade.ciudadanos.auth.dto.RegisterRequest;
import ar.edu.uade.ciudadanos.auth.dto.RegisterResponse;
import ar.edu.uade.ciudadanos.auth.dto.Sesion;
import ar.edu.uade.ciudadanos.auth.dto.TokenEmitido;
import ar.edu.uade.ciudadanos.common.ApiException;
import ar.edu.uade.ciudadanos.empleado.entity.CredencialEmpleado;
import ar.edu.uade.ciudadanos.empleado.entity.CuentaEmpleado;
import ar.edu.uade.ciudadanos.empleado.repository.CredencialEmpleadoRepository;
import ar.edu.uade.ciudadanos.empleado.repository.CuentaEmpleadoRepository;
import ar.edu.uade.ciudadanos.persona.entity.Ciudadano;
import ar.edu.uade.ciudadanos.persona.entity.CredencialCiudadano;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.CredencialCiudadanoRepository;
import ar.edu.uade.ciudadanos.security.AuthPrincipal;
import ar.edu.uade.ciudadanos.security.JwtService;
import ar.edu.uade.ciudadanos.security.Rol;
import ar.edu.uade.ciudadanos.security.TipoSujeto;
import ar.edu.uade.ciudadanos.auth.dto.UsuarioLoginRequest;
import ar.edu.uade.ciudadanos.auth.dto.UsuarioLoginResponse;
import ar.edu.uade.ciudadanos.contacto.dto.ContactoResponse;
import ar.edu.uade.ciudadanos.contacto.entity.TipoContacto;
import ar.edu.uade.ciudadanos.contacto.repository.ContactoCiudadanoRepository;
import ar.edu.uade.ciudadanos.evento.EventPublisherService;
import ar.edu.uade.ciudadanos.evento.dto.UpdatedBy;
import java.util.List;
import java.util.Map;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Alta de cuentas y emision de tokens (RF-01, RF-02, RF-36, RF-37). */
@Service
public class AuthService {

    private final CiudadanoRepository ciudadanoRepository;
    private final CredencialCiudadanoRepository credencialCiudadanoRepository;
    private final CuentaEmpleadoRepository cuentaEmpleadoRepository;
    private final CredencialEmpleadoRepository credencialEmpleadoRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final ContactoCiudadanoRepository contactoRepository;
    private final EventPublisherService eventPublisherService;

    public AuthService(CiudadanoRepository ciudadanoRepository,
                       CredencialCiudadanoRepository credencialCiudadanoRepository,
                       CuentaEmpleadoRepository cuentaEmpleadoRepository,
                       CredencialEmpleadoRepository credencialEmpleadoRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this(ciudadanoRepository, credencialCiudadanoRepository, cuentaEmpleadoRepository,
             credencialEmpleadoRepository, passwordEncoder, jwtService, null, null);
    }

    public AuthService(CiudadanoRepository ciudadanoRepository,
                       CredencialCiudadanoRepository credencialCiudadanoRepository,
                       CuentaEmpleadoRepository cuentaEmpleadoRepository,
                       CredencialEmpleadoRepository credencialEmpleadoRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       ContactoCiudadanoRepository contactoRepository,
                       EventPublisherService eventPublisherService) {
        this.ciudadanoRepository = ciudadanoRepository;
        this.credencialCiudadanoRepository = credencialCiudadanoRepository;
        this.cuentaEmpleadoRepository = cuentaEmpleadoRepository;
        this.credencialEmpleadoRepository = credencialEmpleadoRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.contactoRepository = contactoRepository;
        this.eventPublisherService = eventPublisherService;
    }

    // ---------------------------------------------------------------- registro

    @Transactional
    public RegisterResponse registrar(RegisterRequest request) {
        Long cuit = normalizarCuit(request.cuit());

        if (ciudadanoRepository.existsByCuit(cuit)) {
            throw ApiException.conflicto("Ya existe un ciudadano registrado con ese CUIT/CUIL");
        }

        exigir(request.dni(), "dni es obligatorio para un ciudadano");
        exigir(request.nombre(), "nombre es obligatorio para un ciudadano");
        exigir(request.apellido(), "apellido es obligatorio para un ciudadano");
        if (request.fechaNacimiento() == null) {
            throw ApiException.invalido("fechaNacimiento es obligatoria para un ciudadano");
        }

        if (ciudadanoRepository.existsByDocumentoId(request.dni())) {
            throw ApiException.conflicto("Ya existe un ciudadano con ese DNI");
        }

        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setCuit(cuit);
        ciudadano.setDocumentoId(request.dni());
        ciudadano.setNombre(request.nombre());
        ciudadano.setApellido(request.apellido());
        ciudadano.setFechaNacimiento(request.fechaNacimiento());
        ciudadano.setEstado(EstadoCiudadano.ACTIVO);
        ciudadano = ciudadanoRepository.save(ciudadano);

        CredencialCiudadano credencial = new CredencialCiudadano();
        credencial.setCiudadano(ciudadano);
        credencial.setPassword(passwordEncoder.encode(request.password()));
        credencialCiudadanoRepository.save(credencial);

        if (eventPublisherService != null) {
            try {
                Map<String, Object> details = Map.of(
                        "dni", ciudadano.getDocumentoId(),
                        "cuil", String.valueOf(ciudadano.getCuit()),
                        "name", ciudadano.getNombre(),
                        "lastname", ciudadano.getApellido(),
                        "birthdate", String.valueOf(ciudadano.getFechaNacimiento()),
                        "state", ciudadano.getEstado().name(),
                        "nationality", "argentina"
                );
                eventPublisherService.publicarCitizenUpdated(
                        ciudadano.getId(),
                        "REGISTERED",
                        details,
                        UpdatedBy.selfService()
                );
            } catch (Exception ignored) {
            }
        }

        return RegisterResponse.fisica(ciudadano.getId(), ciudadano.getDocumentoId(), ciudadano.getNombre(),
                ciudadano.getApellido(), ciudadano.getFechaNacimiento(), String.valueOf(ciudadano.getCuit()),
                ciudadano.getEstado().name(), ciudadano.getCreadoEn());
    }

    // ------------------------------------------------------------------- login

    @Transactional(readOnly = true)
    public Sesion<LoginResponse> login(LoginRequest request) {
        Long cuit = normalizarCuit(request.cuit());

        Ciudadano ciudadano = ciudadanoRepository.findByCuit(cuit)
                .orElseThrow(() -> ApiException.noEncontrado("No hay un ciudadano registrado con ese CUIT/CUIL"));

        CredencialCiudadano credencial = credencialCiudadanoRepository.findByCiudadano_Cuit(cuit)
                .orElseThrow(() -> ApiException.noAutenticado("Credenciales invalidas"));

        if (!passwordEncoder.matches(request.password(), credencial.getPassword())) {
            throw ApiException.noAutenticado("Credenciales invalidas");
        }

        if (ciudadano.getEstado() != EstadoCiudadano.ACTIVO) {
            throw ApiException.prohibido("La cuenta esta " + ciudadano.getEstado());
        }

        String rol = Rol.PERSONA.name();
        TipoSujeto tipoSujeto = TipoSujeto.CIUDADANO;

        TokenEmitido tokens = emitir(new AuthPrincipal(ciudadano.getId(), tipoSujeto, rol));
        return new Sesion<>(new LoginResponse(ciudadano.getId(), "CIUDADANO", rol), tokens);
    }

    @Transactional(readOnly = true)
    public Sesion<EmpleadoLoginResponse> loginEmpleado(EmpleadoLoginRequest request) {
        CuentaEmpleado empleado = cuentaEmpleadoRepository.findByMailIgnoreCase(request.mail())
                .orElseThrow(() -> ApiException.noAutenticado("Credenciales invalidas"));

        CredencialEmpleado credencial = credencialEmpleadoRepository.findByEmpleadoId(empleado.getEmpleadoId())
                .orElseThrow(() -> ApiException.noAutenticado("Credenciales invalidas"));

        if (!passwordEncoder.matches(request.password(), credencial.getPassword())) {
            throw ApiException.noAutenticado("Credenciales invalidas");
        }
        if (!empleado.isActivo()) {
            throw ApiException.prohibido("El empleado esta inactivo");
        }

        // El rol del empleado va al claim "rol" del JWT via AuthPrincipal.
        String rol = Rol.deEmpleado(empleado.getRol()).name();
        TokenEmitido tokens = emitir(new AuthPrincipal(empleado.getEmpleadoId(), TipoSujeto.EMPLEADO, rol));
        return new Sesion<>(new EmpleadoLoginResponse(empleado.getEmpleadoId(), rol), tokens);
    }

    /**
     * Endpoint unificado de login de usuario segun especificacion (pág. 9 del PDF).
     * Recibe { "gmail": "...", "password": "..." } y responde con { user_id, dni, role, auth }.
     */
    @Transactional(readOnly = true)
    public Sesion<UsuarioLoginResponse> loginUsuario(UsuarioLoginRequest request) {
        String email = request.gmail().trim();

        // 1. Probar si es empleado municipal por su mail
        var optEmpleado = cuentaEmpleadoRepository.findByMailIgnoreCase(email);
        if (optEmpleado.isPresent()) {
            CuentaEmpleado emp = optEmpleado.get();
            var cred = credencialEmpleadoRepository.findByEmpleadoId(emp.getEmpleadoId())
                    .orElseThrow(() -> ApiException.noAutenticado("Credenciales invalidas"));
            if (!passwordEncoder.matches(request.password(), cred.getPassword())) {
                throw ApiException.noAutenticado("Credenciales invalidas");
            }
            if (!emp.isActivo()) {
                throw ApiException.prohibido("El empleado esta inactivo");
            }
            AuthPrincipal principal = new AuthPrincipal(emp.getEmpleadoId(), TipoSujeto.EMPLEADO, emp.getRol().name());
            TokenEmitido tokens = emitir(principal);
            List<ContactoResponse> contactos = List.of(
                    new ContactoResponse(null, TipoContacto.EMAIL, emp.getMail(), true)
            );
            UsuarioLoginResponse cuerpo = new UsuarioLoginResponse(
                    emp.getEmpleadoId(),
                    0,
                    emp.getNombreEmpleado(),
                    emp.getApellidoEmpleado(),
                    null,
                    emp.getRol().name(),
                    true,
                    contactos
            );
            return new Sesion<>(cuerpo, tokens);
        }

        // 2. Probar si es ciudadano registrado con ese email de contacto
        if (contactoRepository != null) {
            List<Long> ciudadanoIds = contactoRepository.findCiudadanoIdsByValor(email);
            for (Long cId : ciudadanoIds) {
                var optC = ciudadanoRepository.findById(cId);
                if (optC.isPresent()) {
                    Ciudadano c = optC.get();
                    var cred = credencialCiudadanoRepository.findByCiudadano_Cuit(c.getCuit());
                    if (cred.isPresent() && passwordEncoder.matches(request.password(), cred.get().getPassword())) {
                        if (c.getEstado() != EstadoCiudadano.ACTIVO) {
                            throw ApiException.prohibido("La cuenta esta " + c.getEstado());
                        }
                        int dni = 0;
                        try {
                            dni = Integer.parseInt(c.getDocumentoId());
                        } catch (Exception ignored) {
                        }
                        AuthPrincipal principal = new AuthPrincipal(c.getId(), TipoSujeto.CIUDADANO, "CIUDADANO");
                        TokenEmitido tokens = emitir(principal);
                        List<ContactoResponse> contactos = contactoRepository.findByCiudadanoId(c.getId()).stream()
                                .map(ContactoResponse::de)
                                .toList();
                        UsuarioLoginResponse cuerpo = new UsuarioLoginResponse(
                                c.getId(),
                                dni,
                                c.getNombre(),
                                c.getApellido(),
                                c.getCuit(),
                                "CIUDADANO",
                                true,
                                contactos
                        );
                        return new Sesion<>(cuerpo, tokens);
                    }
                }
            }
        }

        throw ApiException.noAutenticado("Credenciales invalidas");
    }

    // ----------------------------------------------------------------- refresh

    /** Rota el par completo: el refresh usado deja de servir cuando vence. */
    public TokenEmitido refrescar(String refreshToken) {
        AuthPrincipal principal = jwtService.validarRefreshToken(refreshToken);
        if (principal == null) {
            throw ApiException.noAutenticado("Refresh token vencido o invalido");
        }
        return emitir(principal);
    }

    private TokenEmitido emitir(AuthPrincipal principal) {
        return new TokenEmitido(
                jwtService.generarAccessToken(principal),
                jwtService.generarRefreshToken(principal),
                jwtService.getAccessTokenTtlSeconds());
    }

    // ------------------------------------------------------------------ helpers

    /** Acepta "20-12345678-9" o "20123456789" y devuelve los 11 digitos. */
    private Long normalizarCuit(String crudo) {
        String digitos = crudo == null ? "" : crudo.replaceAll("\\D", "");
        if (digitos.length() != 11) {
            throw ApiException.invalido("El CUIT/CUIL debe tener 11 digitos");
        }
        return Long.valueOf(digitos);
    }

    private void exigir(String valor, String mensaje) {
        if (valor == null || valor.isBlank()) {
            throw ApiException.invalido(mensaje);
        }
    }
}
