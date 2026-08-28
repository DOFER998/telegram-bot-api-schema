import { defineType } from '#kit';

export default defineType('MessageOriginChannel', {
  semantics: {
    date: 'unix_date',
  },
});
