package ar.edu.uade.ciudadanos.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final AuthPrincipal CIUDADANO = new AuthPrincipal(7L, TipoSujeto.CIUDADANO, Rol.PERSONA.name());

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(propiedades(600, 3600));
    }

    private JwtProperties propiedades(long accessTtl, long refreshTtl) {
        JwtProperties props = new JwtProperties();
        props.setSecret("c2VjcmV0by1kZS1wcnVlYmEtcXVlLXN1cGVyYS1sb3MtMzItYnl0ZXMtcmVxdWVyaWRvcw==");
        props.setIssuer("modulo1-ciudadanos");
        props.setAccessTokenTtlSeconds(accessTtl);
        props.setRefreshTokenTtlSeconds(refreshTtl);
        return props;
    }

    @Test
    void elAccessTokenConservaIdTipoYRol() {
        AuthPrincipal recuperado = jwtService.validarAccessToken(jwtService.generarAccessToken(CIUDADANO));

        assertThat(recuperado).isEqualTo(CIUDADANO);
    }

    @Test
    void unRefreshTokenNoSirveComoAccessToken() {
        String refresh = jwtService.generarRefreshToken(CIUDADANO);

        assertThat(jwtService.validarAccessToken(refresh)).isNull();
        assertThat(jwtService.validarRefreshToken(refresh)).isEqualTo(CIUDADANO);
    }

    @Test
    void unTokenFirmadoConOtraClaveNoValida() {
        JwtProperties otras = propiedades(600, 3600);
        otras.setSecret("b3RyYS1jbGF2ZS1kaXN0aW50YS1wZXJvLWlndWFsLWRlLWxhcmdhLXBhcmEtaHMyNTY=");
        String ajeno = new JwtService(otras).generarAccessToken(CIUDADANO);

        assertThat(jwtService.validarAccessToken(ajeno)).isNull();
    }

    @Test
    void unTokenVencidoNoValida() {
        JwtService conTtlVencido = new JwtService(propiedades(-1, -1));

        assertThat(jwtService.validarAccessToken(conTtlVencido.generarAccessToken(CIUDADANO))).isNull();
    }

    /**
     * El rol del empleado tiene que viajar en el token: se decodifica el JWT y
     * se mira el claim, no solo el objeto que devuelve la validacion.
     */
    @Test
    void elTokenLlevaElRolDelEmpleadoEnElClaimRol() {
        AuthPrincipal empleado = new AuthPrincipal(42L, TipoSujeto.EMPLEADO, Rol.RESPONSABLE_AREA.name());

        io.jsonwebtoken.Claims claims = jwtService.parsear(jwtService.generarAccessToken(empleado));

        assertThat(claims.get("rol", String.class)).isEqualTo("RESPONSABLE_AREA");
        assertThat(claims.get("sub_type", String.class)).isEqualTo("EMPLEADO");
        assertThat(claims.getSubject()).isEqualTo("42");
    }

    /** Y para una persona, el rol unificado. */
    @Test
    void elTokenDeUnaJuridicaLlevaRolPersonaYTipoJuridica() {
        AuthPrincipal juridica = new AuthPrincipal(7L, TipoSujeto.JURIDICA, Rol.PERSONA.name());

        io.jsonwebtoken.Claims claims = jwtService.parsear(jwtService.generarAccessToken(juridica));

        assertThat(claims.get("rol", String.class)).isEqualTo("PERSONA");
        assertThat(claims.get("sub_type", String.class)).isEqualTo("JURIDICA");
    }

    @Test
    void unSecretoCortoNoArranca() {
        JwtProperties debiles = propiedades(600, 3600);
        debiles.setSecret("corto");

        assertThatThrownBy(() -> new JwtService(debiles))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("256 bits");
    }
}
