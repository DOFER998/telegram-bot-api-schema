import { defineEnum } from '#kit';

export default defineEnum('ParseMode', {
  description: 'Formatting modes accepted by the parse_mode parameter.',
  static: {
    Html: 'HTML',
    Markdown: 'Markdown',
    MarkdownV2: 'MarkdownV2',
  },
  applies: ['*.parse_mode', '*.text_parse_mode', '*.description_parse_mode'],
});
