import { defineType } from '#kit';

export default defineType('UniqueGiftInfo', {
  semantics: {
    next_transfer_date: 'unix_date',
  },
});
