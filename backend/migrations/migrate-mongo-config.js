// Configuración de migrate-mongo: lee MONGODB_URI de backend/.env (nunca se versiona)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.MONGODB_URI;
if (!url) {
  throw new Error('Falta MONGODB_URI en backend/.env (copie .env.example)');
}

// Nombre de la base tomado de la URI (…mongodb.net/translogic_db?…)
const coincidencia = url.match(/\/([^/?]+)(\?|$)/);
const databaseName = coincidencia ? coincidencia[1] : 'translogic_db';

module.exports = {
  mongodb: { url, databaseName, options: {} },
  migrationsDir: path.join(__dirname, 'versiones'),
  changelogCollectionName: 'changelog',
  lockCollectionName: 'changelog_lock',
  lockTtl: 0,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
