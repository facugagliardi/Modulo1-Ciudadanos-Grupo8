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

    public AuthService(CiudadanoRepository ciudadanoRepository,
                       CredencialCiudadanoRepository credencialCiudadanoRepository,
                       CuentaEmpleadoRepository cuentaEmpleadoRepository,
                       CredencialEmpleadoRepository credencialEmpleadoRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.ciudadanoRepository = ciudadanoRepository;
        this.credencialCiudadanoRepository = credencialCiudadanoRepository;
        this.cuentaEmpleadoRepository = cuentaEmpleadoRepository;
        this.credencialEmpleadoRepository = credencialEmpleadoRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
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
