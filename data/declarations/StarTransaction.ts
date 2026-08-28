import { defineType } from '#kit';

export default defineType('StarTransaction', {
  semantics: {
    date: 'unix_date',
  },
});
