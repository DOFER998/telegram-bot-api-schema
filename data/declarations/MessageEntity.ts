import { defineType } from '#kit';

export default defineType('MessageEntity', {
  semantics: {
    unix_time: 'unix_date',
  },
});
