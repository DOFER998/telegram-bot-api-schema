import { defineEnum } from '#kit';

export default defineEnum('StickerFormat', {
  description: 'Formats accepted when a sticker is uploaded.',
  parse: {
    entity: 'InputSticker',
    attribute: 'format',
    pattern: /“([a-z][a-z0-9_]*)”/g,
  },
  applies: ['setStickerSetThumbnail.format', 'uploadStickerFile.sticker_format'],
});
