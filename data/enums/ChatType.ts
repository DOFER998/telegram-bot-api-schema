import { defineEnum } from '#kit';

export default defineEnum('ChatType', {
  description: 'Kinds of chat the type field can report.',
  parse: {
    entity: 'Chat',
    attribute: 'type',
    pattern: /“([a-z][a-z0-9_]*)”/g,
  },
  applies: ['ChatFullInfo.type'],
});
