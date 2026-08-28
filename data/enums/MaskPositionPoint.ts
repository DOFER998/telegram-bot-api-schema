import { defineEnum } from '#kit';

export default defineEnum('MaskPositionPoint', {
  description: 'Parts of a face a mask can be attached to.',
  parse: {
    entity: 'MaskPosition',
    attribute: 'point',
    pattern: /“([a-z][a-z0-9_]*)”/g,
  },
});
