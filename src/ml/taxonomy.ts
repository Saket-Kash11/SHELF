export const TAXONOMY = {
  mood: [
    'Cozy', 'Dark & Gritty', 'Melancholic', 'Uplifting', 'Tense & Thrilling',
    'Whimsical', 'Thought-Provoking', 'Heartwarming', 'Chilling', 'Adventurous',
    'Romantic', 'Funny & Witty', 'Emotionally Heavy', 'Light & Breezy', 'Nostalgic'
  ],
  pace: ['Slow Burn', 'Fast-Paced', 'Balanced', 'Episodic'],
  setting: [
    'Contemporary', 'Historical', 'Futuristic', 'Fantasy World', 'Rural', 'Urban',
    'Space', 'Ocean', 'Post-Apocalyptic', 'Alternate History', 'Mythological'
  ],
  theme: [
    'Coming of Age', 'Identity & Self-Discovery', 'Power & Politics', 'Survival',
    'Love & Relationships', 'Family Dynamics', 'Friendship', 'Grief & Loss',
    'Morality & Ethics', 'Nature & Environment', 'War & Conflict',
    'Technology & Society', 'Religion & Faith', 'Class & Inequality',
    'Mental Health', 'Art & Creativity', 'Crime & Justice', 'Redemption'
  ],
  genre: [
    'Literary Fiction', 'Science Fiction', 'Fantasy', 'Horror', 'Mystery',
    'Thriller', 'Romance', 'Historical Fiction', 'Contemporary Fiction',
    'Non-Fiction', 'Biography', 'Self-Help', 'Philosophy', 'Poetry',
    'Graphic Novel', 'Young Adult', 'Children\'s', 'Short Stories', 'Essays', 'Classics'
  ]
} as const;

export type TagCategory = keyof typeof TAXONOMY;
export type TagName = typeof TAXONOMY[TagCategory][number];

export const ALL_TAGS = [
  ...TAXONOMY.mood,
  ...TAXONOMY.pace,
  ...TAXONOMY.setting,
  ...TAXONOMY.theme,
  ...TAXONOMY.genre
];
