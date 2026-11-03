package ar.edu.uade.ciudadanos.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.Jwts;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class ModuleTokenServiceTest {
    private static KeyPair coreKeys;

    @BeforeAll
    static void generarClaves() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        coreKeys = generator.generateKeyPair();
    }

    @Test
    void aceptaTokenRs256DeAmbienteConContratoCompleto() {
        ModuleTokenService service = new ModuleTokenService(properties(coreKeys, Set.of("ambiente")));

        AuthPrincipal principal = service.validar(token(coreKeys.getPrivate(), "muni-core", "muni-platform",
                "module", "module:ambiente", "token-1", 900, false));

        assertThat(principal).isEqualTo(new AuthPrincipal(null, TipoSujeto.SERVICIO, Rol.SERVICIO.name()));
    }

    @Test
    void rechazaModuloNoAutorizadoYClaimsIncorrectos() {
        ModuleTokenService service = new ModuleTokenService(properties(coreKeys, Set.of("ambiente")));

        assertThat(service.validar(token(coreKeys.getPrivate(), "muni-core", "muni-platform",
                "module", "module:obras", "token-1", 900, false))).isNull();
        assertThat(service.validar(token(coreKeys.getPrivate(), "otro", "muni-platform",
                "module", "module:ambiente", "token-1", 900, false))).isNull();
        assertThat(service.validar(token(coreKeys.getPrivate(), "muni-core", "otra",
                "module", "module:ambiente", "token-1", 900, false))).isNull();
        assertThat(service.validar(token(coreKeys.getPrivate(), "muni-core", "muni-platform",
                "user", "module:ambiente", "token-1", 900, false))).isNull();
        assertThat(service.validar(token(coreKeys.getPrivate(), "muni-core", "muni-platform",
                "module", "ambiente", "token-1", 900, false))).isNull();
        assertThat(service.validar(token(coreKeys.getPrivate(), "muni-core", "muni-platform",
                "module", "module:ambiente", null, 900, false))).isNull();
    }

    @Test
    void rechazaFirmaAjenaAlgoritmoDistintoYTokenVencido() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair other = generator.generateKeyPair();
        ModuleTokenService service = new ModuleTokenService(properties(coreKeys, Set.of("ambiente")));

        assertThat(service.validar(token(other.getPrivate(), "muni-core", "muni-platform",
                "module", "module:ambiente", "token-1", 900, false))).isNull();
        assertThat(service.validar(token(coreKeys.getPrivate(), "muni-core", "muni-platform",
                "module", "module:ambiente", "token-1", 900, true))).isNull();
        assertThat(service.validar(token(coreKeys.getPrivate(), "muni-core", "muni-platform",
                "module", "module:ambiente", "token-1", -1, false))).isNull();
    }

    @Test
    void sinClaveNoHabilitaModulosYClaveInvalidaImpideArranque() {
        ModuleTokenProperties disabled = properties(coreKeys, Set.of("ambiente"));
        disabled.setPublicKeyPem("");
        assertThat(new ModuleTokenService(disabled).validar("cualquier-token")).isNull();

        ModuleTokenProperties invalid = properties(coreKeys, Set.of("ambiente"));
        invalid.setPublicKeyPem("no-es-pem");
        assertThatThrownBy(() -> new ModuleTokenService(invalid))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("clave publica RSA valida");
    }

    private static ModuleTokenProperties properties(KeyPair keys, Set<String> allowed) {
        ModuleTokenProperties properties = new ModuleTokenProperties();
        String base64 = Base64.getMimeEncoder(64, new byte[]{'\n'}).encodeToString(keys.getPublic().getEncoded());
        properties.setPublicKeyPem("-----BEGIN PUBLIC KEY-----\\n" + base64.replace("\n", "\\n")
                + "\\n-----END PUBLIC KEY-----");
        properties.setIssuer("muni-core");
        properties.setAudience("muni-platform");
        properties.setAllowedModules(allowed);
        return properties;
    }

    private static String token(PrivateKey key, String issuer, String audience, String kind,
                                String subject, String jti, long ttl, boolean rs512) {
        var builder = Jwts.builder().issuer(issuer).subject(subject).claim("aud", audience)
                .claim("kind", kind).issuedAt(new Date()).expiration(Date.from(Instant.now().plusSeconds(ttl)));
        if (jti != null) {
            builder.id(jti);
        }
        return rs512 ? builder.signWith(key, Jwts.SIG.RS512).compact()
                : builder.signWith(key, Jwts.SIG.RS256).compact();
    }
}
