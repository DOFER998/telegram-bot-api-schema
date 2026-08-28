import { defineType } from '#kit';

export default defineType('MessageOriginHiddenUser', {
  semantics: {
    date: 'unix_date',
  },
});
