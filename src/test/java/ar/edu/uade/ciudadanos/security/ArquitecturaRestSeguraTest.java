package ar.edu.uade.ciudadanos.security;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RestController;

/**
 * Keeps the application outside the preconditions of CVE-2026-47884/47890.
 * If server-rendered views or SSE are introduced, review config/sca-excepciones.json
 * and upgrade the framework before changing these constraints.
 */
class ArquitecturaRestSeguraTest {

    private static final JavaClasses APLICACION = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("ar.edu.uade.ciudadanos");

    @Test
    void laApiNoUsaVistasNiResolversDePlantillas() {
        noClasses().should().dependOnClassesThat().haveNameMatching(
                "org\\.springframework\\.web\\.servlet\\.(view\\..*|View|ViewResolver|ModelAndView)")
                .because("the REST API must not enable XSLT or fragment view rendering")
                .check(APLICACION);
    }

    @Test
    void laApiNoUsaEmisoresDeEventosSse() {
        noClasses().should().dependOnClassesThat().haveNameMatching(
                "org\\.springframework\\.(web\\.servlet\\.mvc\\.method\\.annotation\\."
                        + "(SseEmitter|ResponseBodyEmitter)|http\\.codec\\.ServerSentEvent)")
                .because("SSE fragment streaming requires a new security assessment")
                .check(APLICACION);
    }

    @Test
    void todosLosControllersDeNegocioDevuelvenCuerposRest() {
        classes().that().areAnnotatedWith(Controller.class)
                .or().areMetaAnnotatedWith(Controller.class)
                .should().beAnnotatedWith(RestController.class)
                .because("the backend returns data, and nginx serves the React application")
                .check(APLICACION);
    }
}
