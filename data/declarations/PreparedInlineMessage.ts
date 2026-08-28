import { defineType } from '#kit';

export default defineType('PreparedInlineMessage', {
  semantics: {
    expiration_date: 'unix_date',
  },
});
