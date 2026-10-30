// Migración 003: secuencias atómicas para los códigos FAC-AAAAMM-0001
module.exports = {
  async up(db) {
    const existe =
      (await db.listCollections({ name: 'contadores' }).toArray()).length > 0;
    const validator = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'secuencia'],
        properties: {
          _id: { bsonType: 'string', pattern: '^FAC-\\d{6}$' },
          secuencia: { bsonType: 'number', minimum: 0 },
        },
      },
    };
    if (existe) {
      await db.command({ collMod: 'contadores', validator });
    } else {
      await db.createCollection('contadores', { validator });
    }
  },

  async down(db) {
    const existe =
      (await db.listCollections({ name: 'contadores' }).toArray()).length > 0;
    if (existe) await db.collection('contadores').drop();
  },
};
