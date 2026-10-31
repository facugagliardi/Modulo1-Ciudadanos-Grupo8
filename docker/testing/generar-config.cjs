const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');

const root = process.env.CONFIG_DIR || '/state';
function write(name, value) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value, { mode: 0o644 });
}
function secret(name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) write(name, randomBytes(36).toString('base64url'));
  return fs.readFileSync(file, 'utf8').trim();
}
const database = secret('database/password');
const rabbit = secret('rabbit/password');
const demo = secret('fixtures/demo-password');
// JwtService espera Base64 estandar (no el alfabeto Base64URL).
write('backend/app.jwt.secret', Buffer.from(secret('backend/app.jwt.secret'), 'base64url').toString('base64'));
write('backend/spring.datasource.password', database);
write('backend/spring.rabbitmq.password', rabbit);
const salt = randomBytes(4);
const passwordHash = Buffer.concat([salt, createHash('sha256').update(salt).update(rabbit).digest()]).toString('base64');
write('rabbit/rabbitmq.conf', [
  'definitions.import_backend = local_filesystem',
  'definitions.local.path = /run/config/rabbit/definitions.json',
  'definitions.skip_if_unchanged = true',
  ''
].join('\n'));
write('rabbit/definitions.json', JSON.stringify({
  users: [{ name: 'ciudadanos', password_hash: passwordHash, hashing_algorithm: 'rabbit_password_hashing_sha256', tags: ['administrator'] }],
  vhosts: [{ name: 'core' }],
  permissions: [{ user: 'ciudadanos', vhost: 'core', configure: '.*', write: '.*', read: '.*' }],
  exchanges: [
    { name: 'muni.inbox', vhost: 'core', type: 'fanout', durable: true, auto_delete: false, internal: false, arguments: {} },
    { name: 'testing.entrantes', vhost: 'core', type: 'direct', durable: true, auto_delete: false, internal: false, arguments: {} },
    { name: 'testing.dlx', vhost: 'core', type: 'fanout', durable: true, auto_delete: false, internal: false, arguments: {} }
  ],
  queues: [
    { name: 'q.ciudadanos', vhost: 'core', durable: true, auto_delete: false, arguments: { 'x-dead-letter-exchange': 'testing.dlx' } },
    { name: 'q.core.testing', vhost: 'core', durable: true, auto_delete: false, arguments: {} },
    { name: 'q.ciudadanos.dlq', vhost: 'core', durable: true, auto_delete: false, arguments: {} }
  ],
  bindings: [
    { source: 'muni.inbox', vhost: 'core', destination: 'q.core.testing', destination_type: 'queue', routing_key: '', arguments: {} },
    { source: 'testing.entrantes', vhost: 'core', destination: 'q.ciudadanos', destination_type: 'queue', routing_key: 'ciudadanos', arguments: {} },
    { source: 'testing.dlx', vhost: 'core', destination: 'q.ciudadanos.dlq', destination_type: 'queue', routing_key: '', arguments: {} }
  ]
}, null, 2));
write('fixtures/cuentas.json', JSON.stringify({
  aviso: 'Solo entorno local de testing. No reutilizar estas cuentas en Retool/Render.',
  ciudadano: { cuit: '20345678901', password: demo },
  otroCiudadano: { cuit: '27234567890', password: demo },
  empleado: { mail: 'admin@testing.invalid', password: demo },
  mesa: { mail: 'mesa@testing.invalid', password: demo },
  auditor: { mail: 'auditor@testing.invalid', password: demo },
  rabbitmq: { usuario: 'ciudadanos', password: rabbit, virtualHost: 'core' }
}, null, 2) + '\n');
console.log('Configuracion privada lista; los secretos no se imprimen.');
