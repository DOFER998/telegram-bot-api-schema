import { defineMethod } from '#kit';

export default defineMethod('createChatInviteLink', {
  semantics: {
    expire_date: 'unix_date',
  },
});
