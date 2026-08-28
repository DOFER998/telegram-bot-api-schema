import { defineEnum } from '#kit';

export default defineEnum('MessageEntityType', {
  description: 'Kinds of entity found in message text.',
  parse: {
    entity: 'MessageEntity',
    attribute: 'type',
    pattern: /“([a-z][a-z0-9_]*)”/g,
  },
});
