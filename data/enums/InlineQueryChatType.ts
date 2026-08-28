import { defineEnum } from '#kit';

export default defineEnum('InlineQueryChatType', {
  description: 'Kinds of chat an inline query can come from.',
  parse: {
    entity: 'InlineQuery',
    attribute: 'chat_type',
    pattern: /“([a-z][a-z0-9_]*)”/g,
  },
});
