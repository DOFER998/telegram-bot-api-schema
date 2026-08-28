import { defineEnum } from '#kit';

export default defineEnum('EncryptedPassportElementType', {
  description: 'Sections of Telegram Passport a bot can request.',
  parse: {
    entity: 'EncryptedPassportElement',
    attribute: 'type',
    pattern: /“([a-z][a-z0-9_]*)”/g,
  },
});
