import { defineType } from '#kit';

export default defineType('Giveaway', {
  semantics: {
    winners_selection_date: 'unix_date',
  },
});
