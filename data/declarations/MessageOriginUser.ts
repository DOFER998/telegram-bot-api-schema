import { defineType } from '#kit';

export default defineType('MessageOriginUser', {
  semantics: {
    date: 'unix_date',
  },
});
