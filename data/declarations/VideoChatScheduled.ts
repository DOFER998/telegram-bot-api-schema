import { defineType } from '#kit';

export default defineType('VideoChatScheduled', {
  semantics: {
    start_date: 'unix_date',
  },
});
