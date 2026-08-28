import { defineMethod } from '#kit';

export default defineMethod('sendPoll', {
  semantics: {
    close_date: 'unix_date',
  },
});
