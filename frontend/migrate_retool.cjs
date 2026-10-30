const dns = require('dns');
const orig = dns.lookup;
dns.lookup = (host, options, cb) => {
  if (typeof options === 'function') { cb = options; options = {}; }
  orig(host, options, (err, address, family) => {
    if (err) return cb(err);
    if (Array.isArray(address)) {
      const v4 = address.filter(a => a.family === 4);
      return cb(null, v4.length ? v4 : address);
    }
    if (family === 6) return orig(host, { family: 4 }, cb);
    return cb(null, address, family);
  });
};

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.POSTGRES_URL?.replace(/^jdbc:/, '');
if (!connectionString || !process.env.POSTGRES_USER || !process.env.POSTGRES_PASSWORD) {
  throw new Error('Definir POSTGRES_URL, POSTGRES_USER y POSTGRES_PASSWORD antes de migrar.');
}

async function migrate() {
  const client = new Client({
    connectionString,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connecting to Retool DB...');
  await client.connect();
  console.log('Connected to Retool successfully!');

  const schemaPath = path.resolve(__dirname, '../db/01_schema.sql');
  const datosPath = path.resolve(__dirname, '../db/02_datos_iniciales.sql');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const datosSql = fs.readFileSync(datosPath, 'utf8');

  console.log('Executing 01_schema.sql...');
  await client.query(schemaSql);
  console.log('01_schema.sql completed successfully.');

  console.log('Executing 02_datos_iniciales.sql...');
  await client.query(datosSql);
  console.log('02_datos_iniciales.sql completed successfully.');

  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Created tables:');
  res.rows.forEach(r => console.log('  - ' + r.table_name));

  const countEmpleados = await client.query('SELECT count(*) FROM cuenta_empleado;');
  const countCiudadanos = await client.query('SELECT count(*) FROM ciudadano;');
  const countCredenciales = await client.query('SELECT count(*) FROM credencial_empleado;');
  console.log(`\nVerifying initial data:`);
  console.log(`  Empleados: ${countEmpleados.rows[0].count}`);
  console.log(`  Ciudadanos: ${countCiudadanos.rows[0].count}`);
  console.log(`  Credenciales empleados: ${countCredenciales.rows[0].count}`);

  await client.end();
  console.log('\nMigration finished successfully!');
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
