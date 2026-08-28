import { defineMethod } from '#kit';

export default defineMethod('editChatInviteLink', {
  semantics: {
    expire_date: 'unix_date',
  },
});
