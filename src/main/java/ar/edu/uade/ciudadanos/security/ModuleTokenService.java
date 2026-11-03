package ar.edu.uade.ciudadanos.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Collection;
import org.springframework.stereotype.Service;

/** Valida localmente los tokens de modulo de Core sin depender de una consulta HTTP por request. */
@Service
public class ModuleTokenService {
    private static final String SUBJECT_PREFIX = "module:";
    private final ModuleTokenProperties properties;
    private final PublicKey publicKey;

    public ModuleTokenService(ModuleTokenProperties properties) {
        this.properties = properties;
        this.publicKey = buildPublicKey(properties.getPublicKeyPem());
    }

    /** Devuelve un principal tecnico o null ante cualquier token no autorizado. */
    public AuthPrincipal validar(String token) {
        if (publicKey == null || token == null || token.isBlank()) {
            return null;
        }
        try {
            Jws<Claims> firmado = Jwts.parser().verifyWith(publicKey).build().parseSignedClaims(token);
            Claims claims = firmado.getPayload();
            String subject = claims.getSubject();
            if (!"RS256".equals(firmado.getHeader().getAlgorithm())
                    || !properties.getIssuer().equals(claims.getIssuer())
                    || !audienciaValida(claims.get("aud"))
                    || !"module".equals(claims.get("kind", String.class))
                    || claims.getId() == null || claims.getId().isBlank()
                    || subject == null || !subject.startsWith(SUBJECT_PREFIX)) {
                return null;
            }
            String module = subject.substring(SUBJECT_PREFIX.length());
            if (module.isBlank() || !properties.getAllowedModules().contains(module)) {
                return null;
            }
            return new AuthPrincipal(null, TipoSujeto.SERVICIO, Rol.SERVICIO.name());
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    private boolean audienciaValida(Object value) {
        if (value instanceof String audience) {
            return properties.getAudience().equals(audience);
        }
        return value instanceof Collection<?> audiences && audiences.contains(properties.getAudience());
    }

    private static PublicKey buildPublicKey(String pem) {
        if (pem == null || pem.isBlank()) {
            return null;
        }
        try {
            String normalized = pem.replace("\\n", "\n")
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] encoded = Base64.getDecoder().decode(normalized);
            return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(encoded));
        } catch (Exception e) {
            throw new IllegalStateException("APP_MODULE_AUTH_PUBLIC_KEY_PEM no contiene una clave publica RSA valida", e);
        }
    }
}
