import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProveedorDeSesion } from "@/lib/auth/SesionContext";
import { abrirSesion, cerrarSesion } from "@/lib/auth/almacen";
import { jwtFalso } from "./jwt";

/**
 * Espera a que `buscar()` devuelva algo, sondeando el DOM.
 *
 * Es `waitFor` sin el costo de las consultas por rol: acá lo que se busca se
 * encuentra con un `querySelector`, que no calcula accesibilidad de nada.
 */
async function esperarA(buscar, { intentos = 50, espera = 10 } = {}) {
  for (let i = 0; i < intentos; i += 1) {
    const encontrado = buscar();
    if (encontrado) return encontrado;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((r) => setTimeout(r, espera));
    });
  }
  throw new Error("No apareció el panel del Selector");
}

/**
 * Elige una opción de un `Selector`.
 *
 * Reemplaza a `userEvent.selectOptions`, que sólo sabe manejar un `<select>`
 * nativo. El Selector ahora es Radix: el panel se abre aparte y vive en un
 * portal, fuera del formulario.
 *
 * Se sigue eligiendo por **valor** (`"INACTIVO"`) y no por el texto que se ve,
 * para que las pruebas no se rompan si se reescribe una etiqueta.
 *
 *   await elegirOpcion("Estado", "INACTIVO");
 *   await elegirOpcion(await screen.findByLabelText("Alcance"), "FIRMA");
 *
 * Por qué eventos sueltos y no `userEvent.click`: Radix abre con `pointerdown`
 * y confirma con las teclas de selección. `userEvent.click` sobre la opción no
 * la elige en jsdom —el gesto de mouse de Radix depende de cosas que jsdom no
 * simula, como la captura de puntero— y la prueba se queda colgada hasta el
 * timeout sin decir por qué. Enter sobre la opción es, además, un camino de
 * usuario real: es como la elige alguien que navega con el teclado.
 */
export async function elegirOpcion(etiquetaOElemento, valor) {
  const disparador =
    typeof etiquetaOElemento === "string" || etiquetaOElemento instanceof RegExp
      ? screen.getByLabelText(etiquetaOElemento)
      : etiquetaOElemento;

  fireEvent.pointerDown(disparador, { button: 0, ctrlKey: false, pointerType: "mouse" });

  // Con `querySelector` y no con `findByRole`: la variante `{hidden: true}`
  // obliga a Testing Library a calcular la accesibilidad de todos los nodos,
  // y en una pantalla con una tabla larga eso tarda más que el timeout de la
  // prueba. El síntoma es un test "colgado" que en realidad está trabajando.
  const panel = await esperarA(() => document.querySelector('[role="listbox"]'));
  const opcion = panel.querySelector(`[data-valor="${valor}"]`);

  if (!opcion) {
    const disponibles = [...panel.querySelectorAll("[data-valor]")]
      .map((o) => o.getAttribute("data-valor"))
      .join(", ");
    throw new Error(`No hay una opción con valor "${valor}". Hay: ${disponibles}`);
  }

  fireEvent.click(opcion);
  await act(async () => {});
}

/**
 * Los textos de las opciones de un `Selector`, en orden.
 *
 * Antes se leían con `within(campo).getAllByRole("option")`, porque en un
 * `<select>` las opciones son hijas del control. Ya no: el panel es un
 * elemento aparte, así que hay que abrirlo para verlas.
 */
export async function opcionesDe(etiquetaOElemento) {
  const disparador =
    typeof etiquetaOElemento === "string" || etiquetaOElemento instanceof RegExp
      ? screen.getByLabelText(etiquetaOElemento)
      : etiquetaOElemento;

  fireEvent.pointerDown(disparador, { button: 0, ctrlKey: false, pointerType: "mouse" });
  const panel = await esperarA(() => document.querySelector('[role="listbox"]'));
  return [...panel.querySelectorAll('[role="option"]')].map((o) => o.textContent.trim());
}

/**
 * Escribe una fecha en un `CampoFecha`.
 *
 * El campo dejó de ser `<input type="date">`: ya no acepta `"2030-01-01"` sino
 * el formato que se lee, `dd/mm/aaaa`. El helper recibe ISO —que es lo que las
 * pruebas ya usaban y lo que viaja al backend— y lo traduce.
 */
export async function escribirFecha(etiquetaOElemento, iso) {
  const campo =
    typeof etiquetaOElemento === "string" || etiquetaOElemento instanceof RegExp
      ? screen.getByLabelText(etiquetaOElemento)
      : etiquetaOElemento;

  await userEvent.clear(campo);
  if (!iso) return;

  const [a, m, d] = iso.split("-");
  await userEvent.type(campo, `${d}/${m}/${a}`);
}

/** Deja una sesión abierta antes de renderizar, como si el usuario hubiera entrado. */
export function conSesion({ id = 1, rol = "RESPONSABLE_AREA", subType = "EMPLEADO" } = {}) {
  abrirSesion({
    accessToken: jwtFalso({ sub: String(id), rol, sub_type: subType }),
    refreshToken: "refresh",
    cuerpo: {},
  });
}

export function sinSesion() {
  cerrarSesion();
}

/**
 * Renderiza con router y sesión. `ruta` es la URL inicial y `patron` el patrón
 * de la ruta, para las pantallas que leen useParams.
 */
export function renderizar(ui, { ruta = "/", patron } = {}) {
  return render(
    <ProveedorDeSesion>
      <MemoryRouter
        initialEntries={[ruta]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {patron ? (
          <Routes>
            <Route path={patron} element={ui} />
          </Routes>
        ) : (
          ui
        )}
      </MemoryRouter>
    </ProveedorDeSesion>,
  );
}
