import { defineMethod } from '#kit';

export default defineMethod('approveSuggestedPost', {
  semantics: {
    send_date: 'unix_date',
  },
});
