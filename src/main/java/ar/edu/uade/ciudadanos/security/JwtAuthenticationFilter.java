package ar.edu.uade.ciudadanos.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Lee {@code Authorization: Bearer <jwt>} y, si el access token valida, deja el
 * {@link AuthPrincipal} en el SecurityContext. Un token invalido no corta la
 * cadena: se sigue sin autenticar y decide la config de seguridad (401/403).
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PREFIJO_BEARER = "Bearer ";
    private static final String PREFIJO_RUTAS_MODULO = "/integraciones/v1/";

    private final JwtService jwtService;
    private final ModuleTokenService moduleTokenService;

    public JwtAuthenticationFilter(JwtService jwtService, ModuleTokenService moduleTokenService) {
        this.jwtService = jwtService;
        this.moduleTokenService = moduleTokenService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(PREFIJO_BEARER)
                && SecurityContextHolder.getContext().getAuthentication() == null) {

            String token = header.substring(PREFIJO_BEARER.length()).trim();
            AuthPrincipal principal = jwtService.validarAccessToken(token);
            if (principal == null && request.getRequestURI().startsWith(PREFIJO_RUTAS_MODULO)) {
                principal = moduleTokenService.validar(token);
            }
            if (principal != null) {
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + principal.rol()));
                var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        chain.doFilter(request, response);
    }
}
