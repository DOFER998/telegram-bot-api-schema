import { defineType } from '#kit';

export default defineType('SuccessfulPayment', {
  semantics: {
    subscription_expiration_date: 'unix_date',
  },
});
