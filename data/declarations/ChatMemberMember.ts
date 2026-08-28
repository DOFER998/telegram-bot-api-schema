import { defineType } from '#kit';

export default defineType('ChatMemberMember', {
  semantics: {
    until_date: 'unix_date',
  },
});
