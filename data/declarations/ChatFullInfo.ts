import { defineType } from '#kit';

export default defineType('ChatFullInfo', {
  semantics: {
    emoji_status_expiration_date: 'unix_date',
  },
});
