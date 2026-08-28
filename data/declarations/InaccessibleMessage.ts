import { defineType } from '#kit';

export default defineType('InaccessibleMessage', {
  semantics: {
    date: 'unix_date',
  },
});
