import { defineType } from '#kit';

export default defineType('PollOption', {
  semantics: {
    addition_date: 'unix_date',
  },
});
