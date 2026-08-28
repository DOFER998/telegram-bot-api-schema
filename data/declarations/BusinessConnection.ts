import { defineType } from '#kit';

export default defineType('BusinessConnection', {
  semantics: {
    date: 'unix_date',
  },
});
