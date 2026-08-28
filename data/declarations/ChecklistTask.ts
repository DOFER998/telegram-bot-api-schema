import { defineType } from '#kit';

export default defineType('ChecklistTask', {
  semantics: {
    completion_date: 'unix_date',
  },
});
