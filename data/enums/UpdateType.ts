import { defineEnum } from '#kit';

export default defineEnum('UpdateType', {
  description: 'Kinds of update a bot can receive — the optional fields of Update.',
  extract: {
    from: 'Update',
    exclude: ['update_id'],
  },
  applies: ['*.allowed_updates'],
});
