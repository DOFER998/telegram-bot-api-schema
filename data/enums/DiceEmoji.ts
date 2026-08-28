import { defineEnum } from '#kit';

export default defineEnum('DiceEmoji', {
  description: 'Emoji accepted by sendDice. The documentation carries them as images, not as text.',
  static: {
    Dice: '🎲',
    Dart: '🎯',
    Basketball: '🏀',
    Football: '⚽',
    Bowling: '🎳',
    SlotMachine: '🎰',
  },
  applies: ['sendDice.emoji', 'Dice.emoji'],
});
