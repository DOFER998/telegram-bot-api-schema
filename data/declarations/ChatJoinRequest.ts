import { defineType } from '#kit';

export default defineType('ChatJoinRequest', {
  semantics: {
    date: 'unix_date',
  },
});
