package ar.edu.uade.ciudadanos.security;

import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuracion para validar los module-token RS256 emitidos por Core/M9. */
@ConfigurationProperties(prefix = "app.module-auth")
public class ModuleTokenProperties {
    private String publicKeyPem;
    private String issuer = "muni-core";
    private String audience = "muni-platform";
    private Set<String> allowedModules = new LinkedHashSet<>();

    public String getPublicKeyPem() { return publicKeyPem; }
    public void setPublicKeyPem(String publicKeyPem) { this.publicKeyPem = publicKeyPem; }
    public String getIssuer() { return issuer; }
    public void setIssuer(String issuer) { this.issuer = issuer; }
    public String getAudience() { return audience; }
    public void setAudience(String audience) { this.audience = audience; }
    public Set<String> getAllowedModules() { return Set.copyOf(allowedModules); }
    public void setAllowedModules(Set<String> allowedModules) {
        this.allowedModules = allowedModules == null ? new LinkedHashSet<>() : new LinkedHashSet<>(allowedModules);
    }
}
