import { defineType } from '#kit';

export default defineType('MessageReactionCountUpdated', {
  semantics: {
    date: 'unix_date',
  },
});
