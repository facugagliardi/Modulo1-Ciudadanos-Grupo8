package ar.edu.uade.ciudadanos.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuracion del bloque {@code app.jwt} de application.yml. */
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    /**
     * Clave HMAC en Base64. Debe tener al menos 256 bits (32 bytes) para HS256.
     * En produccion viene por variable de entorno, nunca del yml versionado.
     */
    private String secret;

    private String issuer = "modulo1-ciudadanos";

    /** Vida del access token, en segundos. */
    private long accessTokenTtlSeconds = 900;

    /** Vida del refresh token, en segundos. */
    private long refreshTokenTtlSeconds = 604800;

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public long getAccessTokenTtlSeconds() {
        return accessTokenTtlSeconds;
    }

    public void setAccessTokenTtlSeconds(long accessTokenTtlSeconds) {
        this.accessTokenTtlSeconds = accessTokenTtlSeconds;
    }

    public long getRefreshTokenTtlSeconds() {
        return refreshTokenTtlSeconds;
    }

    public void setRefreshTokenTtlSeconds(long refreshTokenTtlSeconds) {
        this.refreshTokenTtlSeconds = refreshTokenTtlSeconds;
    }
}
