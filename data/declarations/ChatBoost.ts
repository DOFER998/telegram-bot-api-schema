import { defineType } from '#kit';

export default defineType('ChatBoost', {
  semantics: {
    add_date: 'unix_date',
    expiration_date: 'unix_date',
  },
});
