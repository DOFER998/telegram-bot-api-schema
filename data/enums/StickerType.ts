import { defineEnum } from '#kit';

export default defineEnum('StickerType', {
  description: 'Kinds of sticker.',
  parse: {
    entity: 'Sticker',
    attribute: 'type',
    pattern: /“([a-z][a-z0-9_]*)”/g,
  },
  applies: ['StickerSet.sticker_type', 'createNewStickerSet.sticker_type'],
});
