import { defineType } from '#kit';

export default defineType('OwnedGiftRegular', {
  semantics: {
    send_date: 'unix_date',
  },
});
