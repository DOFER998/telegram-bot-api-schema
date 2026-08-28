import { defineMethod } from '#kit';

export default defineMethod('restrictChatMember', {
  semantics: {
    until_date: 'unix_date',
  },
});
