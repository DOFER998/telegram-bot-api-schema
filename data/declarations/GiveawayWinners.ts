import { defineType } from '#kit';

export default defineType('GiveawayWinners', {
  semantics: {
    winners_selection_date: 'unix_date',
  },
});
