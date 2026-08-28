import { defineType } from '#kit';

export default defineType('PassportFile', {
  semantics: {
    file_date: 'unix_date',
  },
});
