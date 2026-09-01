package ar.edu.uade.ciudadanos.auth;

import ar.edu.uade.ciudadanos.auth.dto.EmpleadoLoginRequest;
import ar.edu.uade.ciudadanos.auth.dto.EmpleadoLoginResponse;
import ar.edu.uade.ciudadanos.auth.dto.LoginRequest;
import ar.edu.uade.ciudadanos.auth.dto.LoginResponse;
import ar.edu.uade.ciudadanos.auth.dto.RefreshRequest;
import ar.edu.uade.ciudadanos.auth.dto.RegisterRequest;
import ar.edu.uade.ciudadanos.auth.dto.RegisterResponse;
import ar.edu.uade.ciudadanos.auth.dto.Sesion;
import ar.edu.uade.ciudadanos.auth.dto.TokenEmitido;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints de autenticacion. Por contrato los tokens viajan en headers
 * ({@code Authorization}, {@code X-Refresh-Token}, {@code X-Token-Expires-In}),
 * nunca en el cuerpo.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final String HEADER_REFRESH = "X-Refresh-Token";
    private static final String HEADER_EXPIRES_IN = "X-Token-Expires-In";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** RF-01, RF-02, RF-37: alta de persona fisica o juridica. */
    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.registrar(request));
    }

    /** RF-36: login de persona con CUIT/CUIL. */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        Sesion<LoginResponse> sesion = authService.login(request);
        return ResponseEntity.ok().headers(headersDe(sesion.tokens())).body(sesion.cuerpo());
    }

    @PostMapping("/empleados/login")
    public ResponseEntity<EmpleadoLoginResponse> loginEmpleado(@Valid @RequestBody EmpleadoLoginRequest request) {
        Sesion<EmpleadoLoginResponse> sesion = authService.loginEmpleado(request);
        return ResponseEntity.ok().headers(headersDe(sesion.tokens())).body(sesion.cuerpo());
    }

    @PostMapping("/refresh")
    public ResponseEntity<Void> refresh(@Valid @RequestBody RefreshRequest request) {
        TokenEmitido tokens = authService.refrescar(request.refreshToken());
        return ResponseEntity.noContent().headers(headersDe(tokens)).build();
    }

    /**
     * Los tokens son stateless: no hay lista de revocacion, asi que el logout
     * solo limpia el contexto y le indica al cliente que descarte sus tokens.
     * Si el equipo necesita corte inmediato de sesion, hace falta una denylist
     * de jti (ver README).
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    private HttpHeaders headersDe(TokenEmitido tokens) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.accessToken());
        headers.set(HEADER_REFRESH, tokens.refreshToken());
        headers.set(HEADER_EXPIRES_IN, String.valueOf(tokens.expiresInSeconds()));
        return headers;
    }
}
