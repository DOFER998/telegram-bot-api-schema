import { defineType } from '#kit';

export default defineType('ChatInviteLink', {
  semantics: {
    expire_date: 'unix_date',
  },
});
