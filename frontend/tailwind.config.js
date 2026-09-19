/**
 * Tailwind no define colores ni medidas propias: consume las variables CSS de
 * src/estilos/tokens.css. Eso permite que el mismo componente se vea holgado en
 * el Portal y compacto en el Backoffice cambiando una sola clase en el layout.
 * Ver DISENO.md.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        tinta: "var(--tinta)",
        papel: "var(--papel)",
        superficie: "var(--superficie)",
        expediente: "var(--expediente)",
        "expediente-suave": "var(--expediente-suave)",
        vigente: "var(--vigente)",
        "vigente-suave": "var(--vigente-suave)",
        alerta: "var(--alerta)",
        "alerta-suave": "var(--alerta-suave)",
        sello: "var(--sello)",
        "sello-suave": "var(--sello-suave)",
        apagado: "var(--apagado)",
        borde: "var(--borde)",
        "borde-fuerte": "var(--borde-fuerte)",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
        caratula: ["'EB Garamond'", "Georgia", "serif"],
      },
      fontSize: {
        base: "var(--texto-base)",
        dato: "var(--texto-dato)",
      },
      spacing: {
        u1: "var(--u1)",
        u2: "var(--u2)",
        u3: "var(--u3)",
        u4: "var(--u4)",
        u5: "var(--u5)",
      },
      height: {
        fila: "var(--alto-fila)",
        control: "var(--alto-control)",
      },
      minHeight: {
        control: "var(--alto-control)",
      },
      borderRadius: {
        DEFAULT: "var(--radio)",
        lg: "calc(var(--radio) * 2)",
      },
      transitionDuration: {
        DEFAULT: "160ms",
      },
    },
  },
  plugins: [],
};
