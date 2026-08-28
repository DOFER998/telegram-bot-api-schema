import { defineType } from '#kit';

export default defineType('RichTextDateTime', {
  semantics: {
    unix_time: 'unix_date',
  },
});
