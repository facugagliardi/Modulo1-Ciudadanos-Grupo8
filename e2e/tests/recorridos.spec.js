import { test, expect } from '@playwright/test';
import { randomInt } from 'node:crypto';

const cuentas = JSON.parse(process.env.E2E_ACCOUNTS || '{}');
const urlBase = process.env.E2E_BASE_URL || 'http://localhost:8090';

async function ingresar(page, cuenta, empleado = false) {
  await page.goto('/ingresar');
  if (empleado) await page.getByRole('radio', { name: 'Soy empleado' }).click();
  await page.getByLabel(empleado ? 'Correo institucional' : 'CUIT o CUIL').fill(cuenta.mail || cuenta.cuit);
  await page.getByLabel(/^Contraseña/).fill(cuenta.password);
  const respuesta = page.waitForResponse(r => r.url().endsWith(empleado ? '/auth/empleados/login' : '/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  const res = await respuesta;
  expect(res.status()).toBe(200);
  const sesion = { datos: await res.json(), authorization: res.headers().authorization };
  expect(Boolean(sesion.authorization)).toBe(true);
  await expect(page).toHaveURL(empleado ? /\/admin$/ : /\/portal$/);
  return sesion;
}

async function api(request, sesion, ruta, metodo = 'GET', datos, status = 200) {
  const res = await request.fetch(`${urlBase}/api${ruta}`, {
    method: metodo, headers: sesion ? { Authorization: sesion.authorization } : {},
    ...(datos === undefined ? {} : { data: datos }),
  });
  expect(res.status(), `${metodo} ${ruta}`).toBe(status);
  return res;
}

async function conPagina(browser, trabajo) {
  const contexto = await browser.newContext({ baseURL: urlBase });
  const pagina = await contexto.newPage();
  try { return await trabajo(pagina); }
  catch (error) {
    await test.info().attach('pagina-secundaria', { body: await pagina.screenshot(), contentType: 'image/png' });
    throw error;
  }
  finally { await contexto.close(); }
}

function pdfSintetico() {
  const contenido = 'BT /F1 12 Tf 20 100 Td (Evidencia sintetica) Tj ET\n';
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(contenido)} >>\nstream\n${contenido}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let texto = '%PDF-1.4\n';
  const posiciones = [0];
  objetos.forEach((objeto, i) => { posiciones.push(Buffer.byteLength(texto)); texto += `${i + 1} 0 obj\n${objeto}\nendobj\n`; });
  const xref = Buffer.byteLength(texto);
  texto += `xref\n0 6\n0000000000 65535 f \n${posiciones.slice(1).map(p => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(texto);
}

test('E2E-01 | HU1 CP-FE-001/003/005 y HU3 CP-FE-014 | ingreso y límites del vecino', async ({ page }) => {
  await page.goto('/ingresar');
  let pedidos = 0;
  page.on('request', r => { if (r.url().endsWith('/auth/login')) pedidos++; });
  await page.getByLabel('CUIT o CUIL').fill('2034567890');
  await page.getByLabel(/^Contraseña/).fill('incorrecta123');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByText('El CUIT/CUIL tiene 11 dígitos.')).toBeVisible();
  expect(pedidos).toBe(0);
  await page.getByLabel('CUIT o CUIL').fill(cuentas.ciudadano.cuit);
  const rechazo = page.waitForResponse(r => r.url().endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  expect((await rechazo).status()).toBe(401);
  await expect(page.getByRole('alert')).toContainText('CUIT/CUIL o contraseña incorrectos');
  await expect(page).toHaveURL(/\/ingresar$/);
  await ingresar(page, cuentas.ciudadano);
  // Esperar el estado final con el ciudadano cargado, no el título transitorio.
  await expect(page.getByRole('heading', { name: 'Hola, Vecino', exact: true })).toBeVisible();
  await expect(page.getByText('Vecino Testing', { exact: true }).first()).toBeVisible();
  await page.goto('/admin/padron');
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole('heading', { name: 'Hola, Vecino', exact: true })).toBeVisible();
});

test('E2E-02 | HU3 CP-FE-013 | auditor sólo lectura y POST 403 sin persistencia', async ({ page, request }) => {
  const auditor = await ingresar(page, cuentas.auditor, true);
  expect(auditor.datos.rol).toBe('AUDITOR');
  for (const [ruta, endpoint] of [['/admin/padron', '/ciudadanos'], ['/admin/padron/1', '/ciudadanos/1'],
    ['/admin/organizaciones', '/organizaciones'], ['/admin/expedientes', '/expedientes']]) {
    const lectura = page.waitForResponse(r => r.url().endsWith(`/api${endpoint}`) && r.request().method() === 'GET');
    await page.goto(ruta);
    expect((await lectura).status()).toBe(200);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByText(/Cargando|Buscando/, { exact: false })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Registrar vecino|Editar datos|Cambiar estado|Registrar organización|Iniciar expediente/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Registrar vecino|Registrar organización|Iniciar expediente/ })).toHaveCount(0);
  }
  await page.goto('/admin/organizaciones/nueva');
  await expect(page.getByRole('heading', { name: 'No tenés acceso a esta sección' })).toBeVisible();
  const cuit = `30${randomInt(100000000, 999999999)}`;
  expect((await (await api(request, auditor, `/organizaciones/cuit/${cuit}`)).json()).existe).toBe(false);
  await api(request, null, '/organizaciones', 'POST', { cuit, razonSocial: 'E2E sin sesión' }, 401);
  await api(request, auditor, '/organizaciones', 'POST', { cuit, razonSocial: 'E2E auditor',
    duenos: [{ personaId: 1, porcentajeTitularidad: 100 }] }, 403);
  expect((await (await api(request, auditor, `/organizaciones/cuit/${cuit}`)).json()).existe).toBe(false);
});

test('E2E-03 | HU11 CP-FE-050/053 | vecino registra y responsable aprueba organización', async ({ page, browser, request }) => {
  const vecino = await ingresar(page, cuentas.ciudadano);
  const cuit = `30${randomInt(100000000, 999999999)}`;
  const nombre = `Organización E2E ${cuit}`;
  await page.goto('/portal/organizaciones/nueva');
  await page.getByLabel('CUIT', { exact: false }).fill(cuit);
  await page.getByLabel('Razón social', { exact: false }).fill(nombre);
  const respuesta = page.waitForResponse(r => r.url().endsWith('/api/organizaciones') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Registrar organización', exact: true }).click();
  const res = await respuesta;
  expect(res.status()).toBe(201);
  const org = await res.json();
  expect(org.estado).toBe('PENDIENTE');
  await expect(page).toHaveURL(new RegExp(`/portal/organizaciones/${org.organizacionId}$`));
  // El badge incluye texto sr-only del BUG-FE-005 ya documentado.
  await expect(page.getByText(/^Pendiente(?:\s|$)/).first()).toBeVisible();
  const duenos = await (await api(request, vecino, `/organizaciones/${org.organizacionId}/duenos`)).json();
  expect(duenos.items).toHaveLength(1);
  expect(duenos.items[0].personaId ?? duenos.items[0].ciudadanoId).toBe(vecino.datos.personaId);
  expect(Number(duenos.items[0].porcentajeTitularidad)).toBe(100);
  await conPagina(browser, async admin => {
    await ingresar(admin, cuentas.empleado, true);
    await admin.goto(`/admin/organizaciones/${org.organizacionId}`);
    const aprobacion = admin.waitForResponse(r => r.url().endsWith(`/organizaciones/${org.organizacionId}/aprobar`));
    await admin.getByRole('button', { name: 'Aprobar organización', exact: true }).click();
    expect((await aprobacion).status()).toBe(200);
    await expect(admin.getByText('Activa', { exact: true }).first()).toBeVisible();
  });
  await page.reload();
  await expect(page.getByText('Activa', { exact: true }).first()).toBeVisible();
  expect((await (await api(request, vecino, `/organizaciones/${org.organizacionId}`)).json()).estado).toBe('ACTIVA');
});

test('E2E-04 | HU14 CP-FE-064 y HU13 CP-FE-060 | pedido, carga y cumplimiento de documentación', async ({ page, browser, request }) => {
  await ingresar(page, cuentas.mesa, true);
  await page.goto('/admin/documentacion');
  await page.getByRole('button', { name: 'Pedir documentación', exact: true }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('DNI del titular', { exact: false }).fill('34567890');
  await dialogo.getByRole('button', { name: 'Buscar', exact: true }).click();
  await dialogo.getByLabel('Documento que se pide', { exact: false }).click();
  await page.getByRole('option', { name: 'Certificado de domicilio', exact: true }).click();
  const plazo = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  await dialogo.getByLabel('Plazo', { exact: false }).fill(plazo.split('-').reverse().join('/'));
  const respuesta = page.waitForResponse(r => r.url().endsWith('/solicitudes-documentacion') && r.request().method() === 'POST');
  await dialogo.getByRole('button', { name: 'Pedir documentación', exact: true }).click();
  const res = await respuesta;
  expect(res.status()).toBe(201);
  const solicitud = await res.json();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Certificado de domicilio', exact: true }).first()).toBeVisible();
  await conPagina(browser, async portal => {
    const vecino = await ingresar(portal, cuentas.ciudadano);
    const inicial = await (await api(request, vecino, `/solicitudes-documentacion/${solicitud.solicitudId}`)).json();
    expect(inicial.estado).toBe('PENDIENTE');
    expect(inicial.plazo).toBe(plazo);
    await portal.goto('/portal/documentacion-solicitada');
    // La base puede contener solicitudes anteriores: asociar por índice del listado real.
    const todas = await (await api(request, vecino, '/solicitudes-documentacion')).json();
    const pendientes = todas.items.filter(s => s.estado !== 'CUMPLIDA');
    const indice = pendientes.findIndex(s => s.solicitudId === solicitud.solicitudId);
    expect(indice).toBeGreaterThanOrEqual(0);
    await portal.getByRole('button', { name: 'Entregar', exact: true }).nth(indice).click();
    const modal = portal.getByRole('dialog');
    const archivo = pdfSintetico();
    await modal.getByLabel('Archivo', { exact: false }).setInputFiles({ name: 'constancia-e2e.pdf', mimeType: 'application/pdf', buffer: archivo });
    const carga = portal.waitForResponse(r => /\/ciudadanos\/\d+\/documentos$/.test(r.url()) && r.request().method() === 'POST');
    const cierre = portal.waitForResponse(r => r.url().endsWith(`/solicitudes-documentacion/${solicitud.solicitudId}/estado`));
    await modal.getByRole('button', { name: 'Entregar documento', exact: true }).click();
    expect((await carga).status()).toBe(201);
    expect((await cierre).status()).toBe(200);
    await expect(modal).toHaveCount(0);
    await expect(portal.getByRole('heading', { name: 'Ya entregadas' })).toBeVisible();
    const final = await (await api(request, vecino, `/solicitudes-documentacion/${solicitud.solicitudId}`)).json();
    expect(final.estado).toBe('CUMPLIDA');
    expect(Number.isInteger(final.documentoId)).toBe(true);
    const documento = await (await api(request, vecino, `/documentos/${final.documentoId}`)).json();
    expect(documento.ciudadanoId).toBe(vecino.datos.personaId);
    expect(documento.tipoDocumento).toBe('CERTIFICADO_DOMICILIO');
    const descarga = await api(request, vecino, `/documentos/${final.documentoId}/archivo`);
    expect(Buffer.compare(await descarga.body(), archivo)).toBe(0);
    const listado = portal.waitForResponse(r => r.url().endsWith(`/ciudadanos/${vecino.datos.personaId}/documentos`) && r.request().method() === 'GET');
    await portal.goto('/portal/documentos');
    const resListado = await listado;
    expect(resListado.status()).toBe(200);
    expect((await resListado.json()).items.some(d => d.documentoId === final.documentoId)).toBe(true);
    await expect(portal.getByRole('heading', { name: 'Mis documentos', exact: true })).toBeVisible();
    await expect(portal.getByText(/^Certificado de domicilio/).first()).toBeVisible();
  });
});

test('E2E-05 | HU15 CP-FE-069/070 | expediente y actuación compartidos con titular', async ({ page, browser, request }) => {
  const mesa = await ingresar(page, cuentas.mesa, true);
  const caratula = `Habilitación E2E ${Date.now()}`;
  const descripcion = `Se recibió documentación E2E ${Date.now()}`;
  await page.goto('/admin/expedientes/nuevo');
  await page.getByLabel('DNI del titular', { exact: false }).fill('34567890');
  await page.getByRole('button', { name: 'Buscar titular', exact: true }).click();
  await page.getByLabel('Carátula', { exact: false }).fill(caratula);
  await page.getByLabel('Área iniciadora', { exact: false }).fill('Mesa de entradas');
  const respuesta = page.waitForResponse(r => r.url().endsWith('/api/expedientes') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Iniciar expediente', exact: true }).click();
  const res = await respuesta;
  expect(res.status()).toBe(201);
  const expediente = await res.json();
  expect(expediente.estado).toBe('INICIADO');
  expect(expediente.numero).toMatch(/^EXP-\d{4}-\d{6}$/);
  await expect(page.getByRole('heading', { name: caratula })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar actuación', exact: true }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Descripción', { exact: false }).fill(descripcion);
  const actuacion = page.waitForResponse(r => r.url().endsWith(`/expedientes/${expediente.expedienteId}/actuaciones`) && r.request().method() === 'POST');
  await dialogo.getByRole('button', { name: 'Registrar actuación', exact: true }).click();
  const resActuacion = await actuacion;
  expect(resActuacion.status()).toBe(201);
  expect((await resActuacion.json()).actuacionId).toBe(1);
  await expect(dialogo).toHaveCount(0);
  // Esperar el refresco: el esqueleto transitorio repite los datos de ejemplo.
  await expect(page.getByText(descripcion, { exact: true })).toHaveCount(1);
  await expect(page.getByText(descripcion, { exact: true })).toBeVisible();
  await conPagina(browser, async portal => {
    const vecino = await ingresar(portal, cuentas.ciudadano);
    await portal.goto('/portal/expedientes');
    await portal.getByRole('link').filter({ hasText: caratula }).click();
    await expect(portal.getByRole('heading', { name: caratula })).toBeVisible();
    await expect(portal.getByText(descripcion, { exact: true })).toHaveCount(1);
    await expect(portal.getByText(descripcion, { exact: true })).toBeVisible();
    await expect(portal.getByRole('button', { name: 'Registrar actuación', exact: true })).toHaveCount(0);
    const actuaciones = await (await api(request, vecino, `/expedientes/${expediente.expedienteId}/actuaciones`)).json();
    expect(actuaciones.items).toHaveLength(1);
    expect(actuaciones.items[0].actuacionId).toBe(1);
  });
  expect((await (await api(request, mesa, `/expedientes/${expediente.expedienteId}`)).json()).ciudadanoId).toBe(1);
});
