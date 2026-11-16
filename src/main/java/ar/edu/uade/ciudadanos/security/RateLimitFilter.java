package ar.edu.uade.ciudadanos.security;

import ar.edu.uade.ciudadanos.common.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Filtro de protección contra ataques de fuerza bruta en endpoints de autenticación.
 * Bloquea temporalmente por IP con HTTP 429 (Too Many Requests) y header Retry-After
 * tras reiterados intentos fallidos.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;
    private final int maxAttempts;
    private final long windowMillis;
    private final long blockDurationMillis;

    private final ConcurrentHashMap<String, Long> blockedIps = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<Long>> attempts = new ConcurrentHashMap<>();

    public RateLimitFilter(
            ObjectMapper objectMapper,
            @Value("${app.security.rate-limit.max-attempts:5}") int maxAttempts,
            @Value("${app.security.rate-limit.duration-seconds:60}") int durationSeconds) {
        this.objectMapper = objectMapper;
        this.maxAttempts = maxAttempts;
        this.windowMillis = durationSeconds * 1000L;
        this.blockDurationMillis = durationSeconds * 1000L;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        if (!esEndpointLogin(request)) {
            chain.doFilter(request, response);
            return;
        }

        String ip = extraerIpCliente(request);
        long ahora = System.currentTimeMillis();

        if (estaBloqueado(ip, ahora)) {
            long restante = Math.max(1, (blockedIps.get(ip) - ahora) / 1000);
            escribirRespuestaBloqueo(request, response, restante);
            return;
        }

        chain.doFilter(request, response);

        int status = response.getStatus();
        if (status == HttpStatus.UNAUTHORIZED.value()) {
            registrarFallo(ip, ahora);
        } else if (status == HttpStatus.OK.value()) {
            reset(ip);
        }
    }

    private boolean esEndpointLogin(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String uri = request.getRequestURI();
        return uri.endsWith("/auth/login")
                || uri.endsWith("/auth/empleados/login")
                || uri.endsWith("/auth/usuario/login");
    }

    private String extraerIpCliente(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    private boolean estaBloqueado(String ip, long ahora) {
        Long bloqueadoHasta = blockedIps.get(ip);
        if (bloqueadoHasta == null) {
            return false;
        }
        if (bloqueadoHasta > ahora) {
            return true;
        }
        blockedIps.remove(ip);
        return false;
    }

    private void registrarFallo(String ip, long ahora) {
        attempts.compute(ip, (k, fallos) -> {
            if (fallos == null) {
                fallos = new ArrayList<>();
            }
            fallos.removeIf(timestamp -> ahora - timestamp > windowMillis);
            fallos.add(ahora);
            if (fallos.size() >= maxAttempts) {
                blockedIps.put(ip, ahora + blockDurationMillis);
                fallos.clear();
            }
            return fallos;
        });
    }

    private void escribirRespuestaBloqueo(HttpServletRequest request, HttpServletResponse response, long retryAfter)
            throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfter));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(),
                ErrorResponse.of(
                        HttpStatus.TOO_MANY_REQUESTS.value(),
                        HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
                        "Demasiados intentos fallidos. Bloqueado temporalmente por seguridad contra fuerza bruta.",
                        request.getRequestURI()));
    }

    public void reset(String ip) {
        blockedIps.remove(ip);
        attempts.remove(ip);
    }

    public void reset() {
        blockedIps.clear();
        attempts.clear();
    }

    public boolean isBlocked(String ip) {
        return estaBloqueado(ip, System.currentTimeMillis());
    }
}
