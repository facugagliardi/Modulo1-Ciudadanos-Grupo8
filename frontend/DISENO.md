# Diseño — Módulo 1

> Por qué la interfaz se ve como se ve. Si vas a agregar una pantalla, leé esto
> antes: la mitad de las decisiones ya están tomadas y son deliberadas.
>
> El contrato con la API está en [`contexto.md`](contexto.md). El mapa de
> pantallas, en [`sitemap.md`](sitemap.md).

---

## De dónde sale

El módulo es el **registro civil digital** del municipio. Su mundo es concreto y
tiene vocabulario propio: el **padrón**, el **expediente** con su número único, la
**carátula**, la **foja**, el **sello**, la **vigencia**. Ese vocabulario ya está
en la interfaz porque está en el dominio; el diseño lo hace visible en vez de
taparlo con una capa de producto genérico.

Lo que **no** se hizo: el azul institucional sobre celeste lavado que tiene
cualquier portal municipal. Es la respuesta por defecto, y además ese celeste
ensucia las tablas densas que este módulo necesita.

Del análisis de estilo se tomó la dirección **accesible y sobria** —contraste
alto, foco visible, cuerpo de 16 px, todo alcanzable con teclado—. Eso no es
decoración: es requisito del enunciado y se evalúa.

---

## Color

Seis valores. Están en [`src/estilos/tokens.css`](src/estilos/tokens.css).

| Token | Hex | Para qué |
|---|---|---|
| `tinta` | `#141A22` | Texto. Negro de archivo, apenas frío |
| `papel` | `#F8F7F4` | Fondo de la aplicación |
| `superficie` | `#FFFFFF` | Tarjetas y tablas |
| `expediente` | `#1B3A5C` | Color principal. Azul institucional profundo |
| `vigente` | `#1F6F4A` | Lo que está en orden |
| `alerta` | `#8A5A00` | Lo que pide una acción |
| `sello` | `#B3341F` | Lo adverso y lo destructivo |

**Contraste verificado sobre `papel`** (mínimo exigido: 4.5:1):

| | ratio |
|---|---|
| `tinta` | 15.9:1 |
| `expediente` | 10.3:1 |
| `vigente` | 5.7:1 |
| `sello` | 5.7:1 |
| `alerta` | 5.5:1 |
| `apagado` (texto secundario) | 5.6:1 |

Ninguno queda al límite. Si agregás un color, calculá el ratio antes.

> La página declara `color-scheme: light`. La paleta está calculada para fondo
> claro; el modo oscuro automático del navegador la invierte por su cuenta y
> rompe estas relaciones. Si alguna vez se hace un tema oscuro, se hace a mano.

### La regla del sello

**`sello` no es un acento decorativo.** Aparece en dos lugares y en ninguno más:

1. Estados adversos: `FALLECIDO`, `BLOQUEADO`, `REVOCADA`, `VENCIDA`, `RECHAZADO`.
2. Acciones destructivas y confirmaciones de las que no se vuelve.

Si lo usás para destacar un botón primario, la señal se diluye y deja de querer
decir algo. Para destacar está `expediente`.

---

## Estados: color y candado son dos cosas distintas

Un estado tiene dos propiedades independientes, y la interfaz las muestra por
separado:

- **Qué tan grave es** → decide el **color**.
- **Si es terminal**, es decir si ya no vuelve atrás → decide si aparece un
  **candado**.

Van separados por dos razones. La primera es de accesibilidad: quien no
distingue colores no puede perderse el dato más importante de la pantalla, que
la acción no se puede deshacer. La segunda es que hay estados terminales que son
buenos: `CUMPLIDA` va en verde **con** candado.

La terminalidad **se deriva del grafo de transiciones**, no se declara con una
lista de nombres. Por eso `VENCIDA` sale terminal en una representación y no
terminal en una solicitud (que todavía puede cumplirse fuera de plazo), que es
exactamente lo que hace el backend.

Todo eso vive en [`src/lib/dominio/estados.js`](src/lib/dominio/estados.js) y lo
usan `<BadgeEstado>` y `<CambiarEstado>`.

---

## Tipografía

Tres familias, cada una con un trabajo:

| Familia | Dónde | Por qué |
|---|---|---|
| **IBM Plex Sans** | Interfaz y cuerpo | Tiene cifras tabulares, imprescindibles en las tablas del padrón. Buen soporte de acentos y eñes. Carácter institucional sin ser el grotesque corporativo de siempre |
| **IBM Plex Mono** | Identificadores | DNI, CUIT/CUIL, número de expediente, ficha |
| **EB Garamond** | Sólo la carátula del expediente | El guiño al papel oficial. Aparece en una pantalla y en ninguna otra |

### Por qué los identificadores van en monoespaciada

No es un gesto estético. Un DNI o un número de expediente son códigos que una
persona compara dígito por dígito contra un papel que tiene en la mano. La
monoespaciada los alinea en columna y hace evidente si a uno le falta una cifra.
Usá `<Identificador>`, que además aplica el formato (`20-34567890-1`,
`28.000.000`).

---

## Densidad: una decisión, dos públicos

Es lo único que separa visualmente al Portal del Backoffice. Mismos colores,
misma tipografía, mismos componentes; cambian las medidas, y se cambian con una
clase en la raíz del layout.

| | Portal del vecino | Backoffice |
|---|---|---|
| Clase | `densidad-holgada` | `densidad-compacta` |
| Quién | Entra dos veces por año, apurado, a menudo desde el teléfono | Pasa ocho horas acá |
| Cuerpo | 16 px | 15 px |
| Alto de fila | 56 px | 36 px |
| Espaciado | 8 / 16 / 24 / 32 | 4 / 8 / 12 / 16 |
| Foco | Una acción clara por pantalla | Densidad y teclado |

Los controles del backoffice bajan a 36 px de alto, cómodo con mouse y muy por
encima del mínimo de 24×24 que pide WCAG 2.2. **Por debajo de 768 px la densidad
compacta vuelve a los valores holgados**: la mano necesita el mismo espacio
aunque el usuario sea un empleado.

Usá siempre los tokens de espaciado (`u1`…`u5`, `h-fila`, `h-control`) en lugar
de valores fijos. Si escribís `p-4`, la pantalla deja de responder a la densidad.

---

## El elemento distintivo: la carátula

`/expedientes/:id`, en las dos zonas, se dibuja como una **carátula de
expediente real**: el número en monoespaciada grande, la carátula en EB
Garamond, el área iniciadora y el titular como campos sellados, y las
actuaciones como **fojas numeradas**.

La numeración 01 / 02 / 03 ahí es información verdadera, no adorno: el
`actuacionId` que devuelve el backend es un contador **por expediente**, así que
el número de foja es un dato del dominio.

Ahí se gasta toda la audacia del sistema. El resto queda callado a propósito.

> Todavía no está construida. Está especificada en `sitemap.md`.

---

## Movimiento

**La regla**: toda animación tiene un trabajo. Si no podés nombrar qué comunica,
no va. Esto es una herramienta de trabajo, no una landing: las duraciones son
cortas y casi todo cae entre 120 y 240 ms. Arriba de 300 ms el sistema se siente
lento, no vivo.

Los tokens están en `tokens.css` y las clases en `globals.css`. **Usá los que ya
existen antes de escribir un `@keyframes` nuevo.**

### Tokens

| Token | Valor | Para qué |
|---|---|---|
| `--dur-1` | 120 ms | Micro-respuesta: presionar un botón, salida de un diálogo |
| `--dur-2` | 180 ms | Superficies chicas, aparición de un aviso |
| `--dur-3` | 240 ms | Diálogos, entrada de pantalla |
| `--ease-salida` | `cubic-bezier(.165,.84,.44,1)` | Algo **entra o sale** de la pantalla |
| `--ease-morph` | `cubic-bezier(.645,.045,.355,1)` | Algo que **ya está** se mueve o cambia de forma |

### Las cinco animaciones del sistema

| Clase / lugar | Trabajo que hace |
|---|---|
| `.entrada` | Entrada de pantalla. Va en el `<main>` de cada layout con `key={pathname}`, así corre una vez por navegación. Orienta: dice "esto es contenido nuevo" |
| `.lista-escalonada` | Escalona los ítems de una lista corta. Hace legible el orden de lectura |
| `.aparece` y todo `[role="alert"]` | Algo acaba de cambiar o de fallar. Se aplica solo a las alertas, sin que cada pantalla lo repita |
| `.sello-entra` | El sello de un estado terminal. **El único gesto con carácter del sistema**, reservado a lo que no vuelve atrás |
| `.fondo-dialogo` / `.panel-dialogo` | Entrada y salida de diálogos. Entrar es más lento que salir: al abrir hay que orientar; al cerrar la persona ya decidió |

Los botones además se hunden al presionarse (`active:scale-[0.98]`, 150 ms). Es
la respuesta más barata que existe: confirma que el click llegó antes de que la
red conteste nada.

### Cuándo NO animar

- **Tablas.** Se re-renderizan con cada tecla del buscador; un escalonado ahí
  parpadea. `.lista-escalonada` va en listas cortas del portal, nunca en `<Tabla>`.
- **`role="status"` que cambia seguido**, como el recuento de resultados. Por eso
  la regla global cubre `[role="alert"]` y no `[role="status"]`.
- **Navegación con teclado y acciones de alta frecuencia.** Cualquier demora
  rompe la sensación de manipulación directa.
- **Nunca escala desde `scale(0)`**: se lee como un efecto, no como un objeto que
  aparece. Los diálogos arrancan en `0.96`.
- **No muevas el elemento que tiene el hover**: si se desplaza, el cursor puede
  salirse del área y el estado parpadea. Movés un hijo — por ejemplo la flecha
  de una tarjeta, no la tarjeta.
- **Sin rebote.** Sólo tendría sentido en gestos de arrastre, que acá no hay.

### Accesibilidad

`prefers-reduced-motion` está resuelto una sola vez en `globals.css` y apaga todo
lo anterior. No hace falta repetirlo por componente, pero tampoco lo saltees con
animaciones en JavaScript. Nadie debería marearse haciendo un trámite municipal.

### Una trampa al depurar diálogos

Radix espera el evento `animationend` para desmontar un diálogo cerrado, y
**Chrome congela las animaciones CSS en pestañas ocultas**. Si mirás una pestaña
en segundo plano —o la manejás con automatización— el diálogo queda en el DOM con
`data-state="closed"` hasta que la pestaña vuelve a estar visible.

No es un error de la aplicación. Perdimos un buen rato diagnosticando un cierre
que en realidad funcionaba. La forma rápida de descartarlo:

```js
document.visibilityState                          // "hidden" explica todo
document.querySelector('.panel-dialogo')?.getAnimations()  // [] con playState "running"
```

Relacionado: el centrado del diálogo usa la propiedad `translate` y la animación
usa `scale`, que son independientes. Si las dos pasaran por `transform`, el
keyframe tendría que repetir el centrado en cada fotograma para no pisarlo.

---

## Reglas que no se negocian

Están evaluadas por la cátedra y varias ya están resueltas en los componentes:

1. **El foco visible nunca se saca.** `:focus-visible` tiene un contorno de 3 px.
   No escribas `outline: none`.
2. **La etiqueta de un campo siempre es visible.** Un *placeholder* no es una
   etiqueta: desaparece justo cuando la persona escribe y necesita recordar qué
   le pidieron. Usá `<Campo>`, que además ata el error con `aria-describedby` y
   marca `aria-invalid`.
3. **El error va pegado al campo**, no en un cartel arriba de todo.
4. **Nunca informar sólo con color.** De ahí el candado de los estados terminales.
5. **Los iconos decorativos llevan `aria-hidden`**; los que son la única
   etiqueta de un botón llevan `aria-label`.
6. **Nada de emojis como iconos.** Se usa `lucide-react`.
7. **Cero scroll horizontal.** Las tablas scrollean dentro de su propio
   contenedor, no la página.

---

## Cuatro estados, no uno

Toda pantalla con datos distingue cuatro situaciones. Están en
[`src/componentes/Estados.jsx`](src/componentes/Estados.jsx) y `<Tabla>` ya las
maneja sola:

| Situación | Componente | Qué dice |
|---|---|---|
| Cargando | `<Cargando>` / `<FilasFantasma>` | Filas fantasma que mantienen el alto y evitan que la página salte |
| Error | `<ErrorEnPantalla>` | Qué pasó, en castellano, con un botón para reintentar |
| Vacío de verdad | `<EstadoVacio>` | Una invitación a hacer algo, no un cartel de error |
| La búsqueda no encontró nada | `<SinResultados>` | Distinto de lo anterior, y ofrece limpiar los filtros |

Confundir los dos últimos es el error más común: "no hay vecinos cargados" y "tu
búsqueda no dio resultados" piden respuestas distintas.

---

## Cómo se escribe en la interfaz

- **Castellano rioplatense, voz activa.** "Ingresá tu DNI", no "Ingrese su DNI"
  ni "DNI requerido".
- **El botón dice lo que va a pasar.** "Confirmar cambio", no "Aceptar".
- **El nombre de una acción no cambia a mitad de camino**: si el botón dice
  "Registrar vecino", el mensaje de éxito dice "Vecino registrado".
- **Los códigos del sistema no se muestran crudos.** `EN_TRAMITE` se lee
  "En trámite"; `EMPLEADO:42:RESPONSABLE_AREA` se lee "Empleado #42 · responsable
  de área". Para eso están `etiquetaEstado`, `etiquetaDe` y `formatearAutor`.
- **Los errores no piden disculpas ni son vagos**: dicen qué pasó y qué hacer.
- **Los errores de contrato no se le muestran al usuario.** Si el backend
  responde "Campo no permitido", el bug es nuestro: se registra en la consola y
  a la persona se le muestra un mensaje genérico. Eso ya lo hace
  `mensajeAmable()`.

---

## Gráficos

Hay **un solo tipo de gráfico** en todo el sistema: barras horizontales
(`<GraficoBarras>`). No es pobreza, es una decisión: los datos del módulo son
recuentos por categoría, y para eso la barra es la forma correcta. Antes de
agregar un segundo tipo, verificá que el trabajo del dato sea realmente otro.

### Las cinco reglas

**1. Todas las barras del mismo gráfico llevan la misma tinta.** Colorear cada
barra distinto según su valor gasta el canal del color en repetir lo que el largo
ya dice, y no deja con qué codificar identidad. La identidad la lleva la etiqueta
de la izquierda — que para los estados es el mismo `<BadgeEstado>` del resto de
la aplicación, con su color y su candado.

**2. El valor va en la punta de la barra.** Un dato que sólo se lee pasando el
mouse no existe para quien usa teclado. El tooltip puede agregar, nunca ser el
único camino.

**3. Todo gráfico tiene una tabla gemela.** El botón "Ver tabla" cambia a un
`<table>` de verdad con recuento y porcentaje. Sin eso, un gráfico deja el dato
fuera de alcance para lectores de pantalla.

**4. Las categorías se ordenan.** Nominales (áreas, tipos) de mayor a menor,
porque comparar magnitudes es el trabajo del gráfico. Los estados, en cambio,
siguen su recorrido real: el embudo del expediente va `INICIADO → EN_TRAMITE →
RESUELTO → ARCHIVADO`, no en orden alfabético.

**5. Una cifra sola no es un gráfico.** Un número que reclama una acción va en un
`<Indicador>`, con su icono, su color por severidad y una frase que dice qué
significa. Una barra sola es peor que el número.

### Lo que no se hace

- **Nada de tortas ni donas.** Comparar ángulos es más difícil que comparar largos.
- **Nada de dos ejes** en un mismo gráfico: la alineación entre las dos escalas es
  arbitraria e inventa correlaciones que no están en los datos.
- **Nada de arcoíris** para magnitud. Una sola tinta.
- **Nada de un número sobre cada punto.** Con barras cortas y el valor en la punta
  alcanza; para el resto está la tabla.
- **Los colores de estado no se reciclan como "serie 4".** Significan algo.

---

## Componentes que ya existen — usalos antes de escribir uno nuevo

| Componente | Para qué |
|---|---|
| `<Tabla>` | Listado con búsqueda, filtros, orden y paginación **del lado del cliente**. Es la respuesta a que el backend devuelva los listados completos sin filtrar |
| `<BadgeEstado>` | Estado con color por valencia y candado si es terminal |
| `<CambiarEstado>` | Diálogo de cambio de estado. Deriva las opciones del grafo, así que el usuario **no puede** provocar un 400 por transición inválida |
| `<Identificador>` | DNI, CUIT, número de expediente, con formato |
| `<Campo>`, `<Selector>`, `<AreaTexto>` | Campos con etiqueta, ayuda y error accesibles |
| `<Encabezado>` | Encabezado de pantalla con la sección arriba |
| `<Button>` | Variantes `primario`, `secundario`, `fantasma`, `destructivo` |
| `<BuscadorDePersona>` | Buscar a alguien por DNI. Aparece cada vez que hay que referirse a una persona: vincular un familiar, abrir un expediente, sumar un dueño |
| `<GraficoBarras>` y `<Indicador>` | Las dos piezas del tablero. Ver arriba |

### Una trampa concreta de Tailwind

Para tamaños de fuente arbitrarios usá siempre el prefijo `length:`:

```jsx
text-[length:var(--texto-dato)]   // ✅
text-[var(--texto-dato)]          // ❌
```

Sin el prefijo, `tailwind-merge` no puede saber si es un tamaño o un color, lo
trata como color y **borra el color de texto que venía antes**. Eso dejó los
botones primarios con el texto en negro sobre azul hasta que se detectó.
