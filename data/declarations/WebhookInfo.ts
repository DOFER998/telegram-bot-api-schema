import { defineType } from '#kit';

export default defineType('WebhookInfo', {
  semantics: {
    last_error_date: 'unix_date',
    last_synchronization_error_date: 'unix_date',
  },
});
