package ar.edu.uade.ciudadanos.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

/** Emision y verificacion de los JWT de acceso y refresco. */
@Service
public class JwtService {

    /** Distingue un access token de un refresh token: claim {@code typ}. */
    static final String CLAIM_TIPO_TOKEN = "typ";
    static final String CLAIM_TIPO_SUJETO = "sub_type";
    static final String CLAIM_ROL = "rol";
    static final String TIPO_ACCESS = "access";
    static final String TIPO_REFRESH = "refresh";

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        this.key = buildKey(properties.getSecret());
    }

    /**
     * Acepta el secreto en Base64 (lo esperado) y cae al texto plano para que el
     * arranque en local no requiera generar la clave primero.
     */
    private static SecretKey buildKey(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("Falta app.jwt.secret: definir APP_JWT_SECRET con >= 32 bytes");
        }
        byte[] bytes;
        try {
            bytes = Decoders.BASE64.decode(secret);
        } catch (IllegalArgumentException notBase64) {
            bytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        if (bytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret debe tener al menos 256 bits (32 bytes) para HS256");
        }
        return Keys.hmacShaKeyFor(bytes);
    }

    public String generarAccessToken(AuthPrincipal principal) {
        return construir(principal, TIPO_ACCESS, Duration.ofSeconds(properties.getAccessTokenTtlSeconds()));
    }

    public String generarRefreshToken(AuthPrincipal principal) {
        return construir(principal, TIPO_REFRESH, Duration.ofSeconds(properties.getRefreshTokenTtlSeconds()));
    }

    public long getAccessTokenTtlSeconds() {
        return properties.getAccessTokenTtlSeconds();
    }

    private String construir(AuthPrincipal principal, String tipoToken, Duration ttl) {
        Instant ahora = Instant.now();
        return Jwts.builder()
                .issuer(properties.getIssuer())
                .subject(String.valueOf(principal.id()))
                .claim(CLAIM_TIPO_SUJETO, principal.tipoInfo().name())
                .claim(CLAIM_ROL, principal.rol())
                .claim(CLAIM_TIPO_TOKEN, tipoToken)
                .issuedAt(Date.from(ahora))
                .expiration(Date.from(ahora.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** @throws JwtException si la firma, el emisor o el vencimiento no validan. */
    public Claims parsear(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(properties.getIssuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /** Valida el token y exige que sea de acceso; devuelve null si no lo es. */
    public AuthPrincipal validarAccessToken(String token) {
        return validar(token, TIPO_ACCESS);
    }

    /** Valida el token y exige que sea de refresco; devuelve null si no lo es. */
    public AuthPrincipal validarRefreshToken(String token) {
        return validar(token, TIPO_REFRESH);
    }

    private AuthPrincipal validar(String token, String tipoEsperado) {
        try {
            Claims claims = parsear(token);
            if (!tipoEsperado.equals(claims.get(CLAIM_TIPO_TOKEN, String.class))) {
                return null;
            }
            return new AuthPrincipal(
                    Long.valueOf(claims.getSubject()),
                    TipoSujeto.valueOf(claims.get(CLAIM_TIPO_SUJETO, String.class)),
                    claims.get(CLAIM_ROL, String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
