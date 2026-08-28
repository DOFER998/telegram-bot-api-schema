import { defineType } from '#kit';

export default defineType('Poll', {
  semantics: {
    close_date: 'unix_date',
  },
});
