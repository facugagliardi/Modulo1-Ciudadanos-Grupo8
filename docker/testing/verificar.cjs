const fs = require('node:fs');
const assert = require('node:assert/strict');
const accounts = JSON.parse(fs.readFileSync('/run/config/fixtures/cuentas.json', 'utf8'));
const base = 'http://frontend';
let checks = 0;
async function request(url, expected, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, expected, `HTTP esperado ${expected} en ${new URL(url).pathname}`);
  checks++;
  return response;
}
async function login(path, body) {
  const response = await request(base + '/api' + path, 200, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const authorization = response.headers.get('authorization');
  assert.ok(authorization?.startsWith('Bearer '), 'El proxy debe preservar el JWT de respuesta');
  const data = await response.json();
  return { headers: { Authorization: authorization }, data };
}
async function main() {
  const health = await (await request(base + '/api/actuator/health', 200)).json();
  assert.equal(health.status, 'UP');
  assert.match(await (await request(base + '/', 200)).text(), /id="root"/);
  assert.match(await (await request(base + '/ingresar', 200)).text(), /id="root"/);
  await request(base + '/api/ciudadanos', 401);
  const citizen = await login('/auth/login', accounts.ciudadano);
  const employee = await login('/auth/empleados/login', accounts.empleado);
  assert.equal(citizen.data.actorType, 'CIUDADANO');
  assert.equal(employee.data.actorType, 'EMPLEADO');
  await request(base + '/api/ciudadanos', 200, { headers: employee.headers });
  await request(base + '/api/ciudadanos', 403, { headers: citizen.headers });
  const contactsUrl = base + '/api/ciudadanos/' + citizen.data.personaId + '/contactos';
  const value = 'persistencia-g1@testing.invalid';
  const list = await (await request(contactsUrl, 200, { headers: citizen.headers })).json();
  const items = list.items;
  assert.ok(Array.isArray(items), 'La lista de contactos debe respetar el contrato items');
  let contact = items.find(item => item.valor === value);
  const memoFile = '/run/config/fixtures/verificacion-persistencia.json';
  if (process.env.EXIGIR_PERSISTENCIA === 'true') {
    assert.ok(contact, 'El contacto debe sobrevivir al down/up sin -v');
    const memo = JSON.parse(fs.readFileSync(memoFile, 'utf8'));
    assert.equal(contact.contactoId, memo.contactoId, 'Debe persistir el mismo recurso');
  } else if (!contact) {
    contact = await (await request(contactsUrl, 201, {
      method: 'POST', headers: { ...citizen.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'EMAIL', valor: value })
    })).json();
    fs.writeFileSync(memoFile, JSON.stringify({ contactoId: contact.contactoId }));
  }
  assert.ok(contact?.contactoId);
  const auth = 'Basic ' + Buffer.from(accounts.rabbitmq.usuario + ':' + accounts.rabbitmq.password).toString('base64');
  const queue = await (await request('http://rabbitmq:15672/api/queues/core/q.ciudadanos', 200, {
    headers: { Authorization: auth }
  })).json();
  assert.ok(queue.consumers >= 1, 'Debe haber un consumidor real de la cola local');
  assert.equal(queue.durable, true);
  console.log(JSON.stringify({ resultado: 'OK', comprobacionesHTTP: checks, consumidorRabbitMQ: true,
    persistenciaVerificada: process.env.EXIGIR_PERSISTENCIA === 'true' }));
}
main().catch(error => {
  // No imprimir requests, cuentas, headers ni tokens.
  console.error('Verificacion G1 fallida:', error.message);
  process.exitCode = 1;
});
