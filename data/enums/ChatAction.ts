import { defineEnum } from '#kit';

export default defineEnum('ChatAction', {
  description: 'Actions a bot can broadcast with sendChatAction.',
  parse: {
    entity: 'sendChatAction',
    attribute: 'action',
    pattern: /<em>([a-z_]+)<\/em>/g,
  },
});
