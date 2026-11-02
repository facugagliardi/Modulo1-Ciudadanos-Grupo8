export function sanear(texto) {
  let salida = String(texto);
  const cuentas = JSON.parse(process.env.E2E_ACCOUNTS || '{}');
  for (const cuenta of Object.values(cuentas)) {
    if (cuenta.password) salida = salida.split(cuenta.password).join('[CLAVE OMITIDA]');
  }
  return salida.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT OMITIDO]');
}
