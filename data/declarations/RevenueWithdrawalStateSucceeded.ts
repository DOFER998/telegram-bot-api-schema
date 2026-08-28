import { defineType } from '#kit';

export default defineType('RevenueWithdrawalStateSucceeded', {
  semantics: {
    date: 'unix_date',
  },
});
