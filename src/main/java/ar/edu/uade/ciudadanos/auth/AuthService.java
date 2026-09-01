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
import ar.edu.uade.ciudadanos.persona.entity.CredencialPersona;
import ar.edu.uade.ciudadanos.persona.entity.EstadoCiudadano;
import ar.edu.uade.ciudadanos.persona.entity.Persona;
import ar.edu.uade.ciudadanos.persona.entity.PersonaJuridica;
import ar.edu.uade.ciudadanos.persona.entity.TipoPersona;
import ar.edu.uade.ciudadanos.persona.repository.CiudadanoRepository;
import ar.edu.uade.ciudadanos.persona.repository.CredencialPersonaRepository;
import ar.edu.uade.ciudadanos.persona.repository.PersonaJuridicaRepository;
import ar.edu.uade.ciudadanos.persona.repository.PersonaRepository;
import ar.edu.uade.ciudadanos.security.AuthPrincipal;
import ar.edu.uade.ciudadanos.security.JwtService;
import ar.edu.uade.ciudadanos.security.Rol;
import ar.edu.uade.ciudadanos.security.TipoSujeto;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Alta de cuentas y emision de tokens (RF-01, RF-02, RF-36, RF-37). */
@Service
public class AuthService {

    // El rol de ciudadanos y personas juridicas es el mismo: los dos son
    // titulares que operan sobre lo propio. Lo que los distingue es
    // tipoPersona, que viaja aparte en el cuerpo y en el claim sub_type.

    private final PersonaRepository personaRepository;
    private final CiudadanoRepository ciudadanoRepository;
    private final PersonaJuridicaRepository personaJuridicaRepository;
    private final CredencialPersonaRepository credencialPersonaRepository;
    private final CuentaEmpleadoRepository cuentaEmpleadoRepository;
    private final CredencialEmpleadoRepository credencialEmpleadoRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(PersonaRepository personaRepository,
                       CiudadanoRepository ciudadanoRepository,
                       PersonaJuridicaRepository personaJuridicaRepository,
                       CredencialPersonaRepository credencialPersonaRepository,
                       CuentaEmpleadoRepository cuentaEmpleadoRepository,
                       CredencialEmpleadoRepository credencialEmpleadoRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.personaRepository = personaRepository;
        this.ciudadanoRepository = ciudadanoRepository;
        this.personaJuridicaRepository = personaJuridicaRepository;
        this.credencialPersonaRepository = credencialPersonaRepository;
        this.cuentaEmpleadoRepository = cuentaEmpleadoRepository;
        this.credencialEmpleadoRepository = credencialEmpleadoRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    // ---------------------------------------------------------------- registro

    @Transactional
    public RegisterResponse registrar(RegisterRequest request) {
        Long cuit = normalizarCuit(request.cuit());

        // RF-06: unicidad de CUIT/CUIL antes de tocar nada.
        if (personaRepository.existsByCuit(cuit)) {
            throw ApiException.conflicto("Ya existe una persona registrada con ese CUIT/CUIL");
        }

        Persona persona = new Persona();
        persona.setTipo(request.tipo());
        persona.setCuit(cuit);
        persona = personaRepository.save(persona);

        CredencialPersona credencial = new CredencialPersona();
        credencial.setPersona(persona);
        credencial.setPassword(passwordEncoder.encode(request.password()));
        credencialPersonaRepository.save(credencial);

        return request.tipo() == TipoPersona.CIUDADANO
                ? registrarCiudadano(request, persona)
                : registrarPersonaJuridica(request, persona);
    }

    private RegisterResponse registrarCiudadano(RegisterRequest request, Persona persona) {
        exigir(request.dni(), "dni es obligatorio para una persona fisica");
        exigir(request.nombre(), "nombre es obligatorio para una persona fisica");
        exigir(request.apellido(), "apellido es obligatorio para una persona fisica");
        if (request.fechaNacimiento() == null) {
            throw ApiException.invalido("fechaNacimiento es obligatoria para una persona fisica");
        }

        if (ciudadanoRepository.existsByDocumentoId(request.dni())) {
            throw ApiException.conflicto("Ya existe un ciudadano con ese DNI");
        }

        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setPersona(persona);
        ciudadano.setDocumentoId(request.dni());
        ciudadano.setNombre(request.nombre());
        ciudadano.setApellido(request.apellido());
        ciudadano.setFechaNacimiento(request.fechaNacimiento());
        ciudadano.setEstado(EstadoCiudadano.ACTIVO);
        ciudadanoRepository.save(ciudadano);

        return RegisterResponse.fisica(persona.getId(), ciudadano.getDocumentoId(), ciudadano.getNombre(),
                ciudadano.getApellido(), ciudadano.getFechaNacimiento(), String.valueOf(persona.getCuit()),
                ciudadano.getEstado().name(), persona.getCreadoEn());
    }

    private RegisterResponse registrarPersonaJuridica(RegisterRequest request, Persona persona) {
        exigir(request.razonSocial(), "razonSocial es obligatoria para una persona juridica");
        exigir(request.nombreFantasia(), "nombreFantasia es obligatorio para una persona juridica");

        PersonaJuridica juridica = new PersonaJuridica();
        juridica.setPersona(persona);
        juridica.setRazonSocial(request.razonSocial());
        juridica.setNombre(request.nombreFantasia());
        juridica.setFechaDeCreacion(request.fechaDeCreacion());
        juridica.setEstado(EstadoCiudadano.ACTIVO);
        personaJuridicaRepository.save(juridica);

        return RegisterResponse.juridica(persona.getId(), String.valueOf(persona.getCuit()),
                juridica.getRazonSocial(), juridica.getNombre(), juridica.getEstado().name(),
                persona.getCreadoEn());
    }

    // ------------------------------------------------------------------- login

    @Transactional(readOnly = true)
    public Sesion<LoginResponse> login(LoginRequest request) {
        Long cuit = normalizarCuit(request.cuit());

        Persona persona = personaRepository.findByCuit(cuit)
                .orElseThrow(() -> ApiException.noEncontrado("No hay una cuenta registrada con ese CUIT/CUIL"));

        CredencialPersona credencial = credencialPersonaRepository.findByPersonaId(persona.getId())
                .orElseThrow(() -> ApiException.noAutenticado("Credenciales invalidas"));

        if (!passwordEncoder.matches(request.password(), credencial.getPassword())) {
            throw ApiException.noAutenticado("Credenciales invalidas");
        }

        String rol = verificarEstadoYResolverRol(persona);
        TipoSujeto tipoSujeto = persona.getTipo() == TipoPersona.CIUDADANO
                ? TipoSujeto.CIUDADANO
                : TipoSujeto.JURIDICA;

        TokenEmitido tokens = emitir(new AuthPrincipal(persona.getId(), tipoSujeto, rol));
        return new Sesion<>(new LoginResponse(persona.getId(), persona.getTipo().name(), rol), tokens);
    }

    /** 403 si la cuenta no esta operativa (bloqueada, inactiva o fallecida). */
    private String verificarEstadoYResolverRol(Persona persona) {
        if (persona.getTipo() == TipoPersona.CIUDADANO) {
            Ciudadano ciudadano = ciudadanoRepository.findById(persona.getId())
                    .orElseThrow(() -> ApiException.noEncontrado("Ciudadano inexistente"));
            if (ciudadano.getEstado() != EstadoCiudadano.ACTIVO) {
                throw ApiException.prohibido("La cuenta esta " + ciudadano.getEstado());
            }
            return Rol.PERSONA.name();
        }

        PersonaJuridica juridica = personaJuridicaRepository.findById(persona.getId())
                .orElseThrow(() -> ApiException.noEncontrado("Persona juridica inexistente"));
        if (juridica.getEstado() != EstadoCiudadano.ACTIVO) {
            throw ApiException.prohibido("La cuenta esta " + juridica.getEstado());
        }
        return Rol.PERSONA.name();
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
