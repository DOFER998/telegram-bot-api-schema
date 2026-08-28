import { defineType } from '#kit';

export default defineType('MessageOriginChat', {
  semantics: {
    date: 'unix_date',
  },
});
