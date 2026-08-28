import { defineType } from '#kit';

export default defineType('Message', {
  semantics: {
    date: 'unix_date',
    edit_date: 'unix_date',
  },
});
