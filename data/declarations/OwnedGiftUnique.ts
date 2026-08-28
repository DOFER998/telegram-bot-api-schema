import { defineType } from '#kit';

export default defineType('OwnedGiftUnique', {
  semantics: {
    send_date: 'unix_date',
    next_transfer_date: 'unix_date',
  },
});
