import { defineEnum } from '#kit';

export default defineEnum('PollType', {
  description: 'Kinds of poll.',
  parse: {
    entity: 'Poll',
    attribute: 'type',
    pattern: /“([a-z][a-z0-9_]*)”/g,
  },
  applies: ['sendPoll.type'],
});
