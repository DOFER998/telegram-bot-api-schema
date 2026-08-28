import { defineMethod } from '#kit';

export default defineMethod('banChatMember', {
  semantics: {
    until_date: 'unix_date',
  },
});
