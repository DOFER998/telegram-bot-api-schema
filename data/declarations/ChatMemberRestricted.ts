import { defineType } from '#kit';

export default defineType('ChatMemberRestricted', {
  semantics: {
    until_date: 'unix_date',
  },
});
