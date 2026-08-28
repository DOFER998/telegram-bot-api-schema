import { defineType } from '#kit';

export default defineType('ChatMemberUpdated', {
  semantics: {
    date: 'unix_date',
  },
});
