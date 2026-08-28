import { defineType } from '#kit';

export default defineType('ChatBoostRemoved', {
  semantics: {
    remove_date: 'unix_date',
  },
});
