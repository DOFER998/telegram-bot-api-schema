import { defineType } from '#kit';

export default defineType('ChatMemberBanned', {
  semantics: {
    until_date: 'unix_date',
  },
});
