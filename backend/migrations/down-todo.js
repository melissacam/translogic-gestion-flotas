// Revierte todas las migraciones aplicadas (usado por npm run db:reset)
const { config, database, down, status } = require('migrate-mongo');

async function main() {
  config.set(require('./migrate-mongo-config'));
  const { db, client } = await database.connect();
  try {
    for (;;) {
      const aplicadas = (await status(db)).filter(
        (m) => m.appliedAt !== 'PENDING',
      );
      if (aplicadas.length === 0) break;
      const revertidas = await down(db, client);
      revertidas.forEach((nombre) => console.log(`REVERTIDA: ${nombre}`));
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
