import { TAXONOMY, type TagCategory } from './taxonomy';

interface TagResult {
  mood: string[];
  pace: string[];
  setting: string[];
  theme: string[];
  genre: string[];
  confidence: Record<string, number>;
}

// Keyword mapping dictionary mapping tags to search phrases
const KEYWORDS: Record<string, string[]> = {
  // Genres
  'Science Fiction': ['science fiction', 'sci-fi', 'space opera', 'cyberpunk', 'futuristic', 'time travel', 'alien', 'galaxy', 'robots'],
  'Fantasy': ['fantasy', 'magic', 'wizard', 'witch', 'spell', 'dragon', 'sword', 'mythical', 'fairy', 'sorcery', 'magical realism'],
  'Horror': ['horror', 'scary', 'gothic', 'ghost', 'vampire', 'creepy', 'chilling', 'spooky', 'supernatural', 'monster', 'haunted'],
  'Mystery': ['mystery', 'detective', 'whodunit', 'crime', 'murder', 'clue', 'sleuth', 'investigate', 'investigation', 'cozy mystery'],
  'Thriller': ['thriller', 'suspense', 'psychological', 'action', 'adventure', 'dangerous', 'chase', 'conspiracy', 'escape'],
  'Romance': ['romance', 'romantic', 'love', 'passion', 'relationship', 'heart', 'boyfriend', 'girlfriend', 'marriage', 'dating'],
  'Historical Fiction': ['historical', 'victorian', 'medieval', 'ancient', 'world war', 'history', 'period', 'century'],
  'Contemporary Fiction': ['contemporary', 'modern life', 'present day', 'realism', 'daily life', 'society'],
  'Non-Fiction': ['non-fiction', 'nonfiction', 'biography', 'memoir', 'essay', 'letters', 'history', 'science', 'math', 'guide', 'self-help'],
  'Biography': ['biography', 'memoir', 'autobiography', 'life story', 'account of the life'],
  'Self-Help': ['self-help', 'self help', 'motivation', 'inspiration', 'personal growth', 'mindset', 'habits', 'guide'],
  'Philosophy': ['philosophy', 'philosophical', 'ethics', 'existential', 'meaning of life', 'reasoning', 'thinkers'],
  'Poetry': ['poetry', 'poem', 'verse', 'rhyme', 'stanza', 'lyric'],
  'Graphic Novel': ['graphic novel', 'comic', 'manga', 'illustrated', 'webtoon'],
  'Young Adult': ['young adult', 'ya', 'teen', 'adolescent', 'high school', 'coming of age'],
  'Children\'s': ['children', 'kids', 'juvenile', 'picture book', 'fable', 'bedtime story'],
  'Short Stories': ['short stories', 'short story', 'collection', 'anthology'],
  'Essays': ['essay', 'essays', 'writings'],
  'Classics': ['classic', 'classics', 'canonical', 'literature', 'masterpiece'],
  'Literary Fiction': ['literary fiction', 'literary', 'drama', 'character-driven', 'depth', 'relationships'],

  // Moods
  'Cozy': ['cozy', 'warm', 'gentle', 'comforting', 'quaint', 'peaceful', 'sweet'],
  'Dark & Gritty': ['dark', 'gritty', 'noir', 'bleak', 'grim', 'shadowy', 'brutal'],
  'Melancholic': ['melancholic', 'sad', 'mournful', 'wistful', 'gloom', 'sorrow', 'depressing', 'tearful'],
  'Uplifting': ['uplifting', 'inspiring', 'hopeful', 'cheerful', 'optimistic', 'joy', 'heartwarming'],
  'Tense & Thrilling': ['tense', 'thrilling', 'action', 'nail-biting', 'heart-pounding', 'suspenseful', 'exciting'],
  'Whimsical': ['whimsical', 'playful', 'magical', 'quirky', 'fanciful', 'fairytale', 'enchanting'],
  'Thought-Provoking': ['thought-provoking', 'intellectual', 'deep', 'philosophical', 'existential', 'insightful', 'mind-bending'],
  'Heartwarming': ['heartwarming', 'sweet', 'tender', 'charming', 'affectionate', 'loving'],
  'Chilling': ['chilling', 'creepy', 'spooky', 'terrifying', 'frightening', 'dread', 'eerie'],
  'Adventurous': ['adventurous', 'adventure', 'quest', 'journey', 'exploration', 'daring', 'expedition'],
  'Romantic': ['romantic', 'romance', 'passionate', 'loving', 'desire'],
  'Funny & Witty': ['funny', 'witty', 'humorous', 'comedy', 'satire', 'ironic', 'hilarious', 'laugh'],
  'Emotionally Heavy': ['emotionally heavy', 'tragic', 'devastating', 'intense drama', 'grief', 'suffering', 'heartbreak'],
  'Light & Breezy': ['light', 'breezy', 'fun', 'easy reading', 'comfort', 'relaxing', 'simple'],
  'Nostalgic': ['nostalgic', 'retro', 'childhood memories', 'yearning', 'past', 'memory'],

  // Pace
  'Slow Burn': ['slow burn', 'slow-paced', 'leisurely', 'character-driven', 'deliberate'],
  'Fast-Paced': ['fast-paced', 'thrilling', 'gripping', 'unputdownable', 'rapid', 'quick'],
  'Balanced': ['balanced pace', 'steady pace', 'well-paced', 'smooth'],
  'Episodic': ['episodic', 'picaresque', 'vignettes', 'serialized'],

  // Settings
  'Contemporary': ['contemporary setting', 'modern day', 'present day', 'our time'],
  'Historical': ['historical setting', 'victorian', 'medieval', 'ancient', 'world war', 'renaissance', '19th century'],
  'Futuristic': ['futuristic', 'future', 'outer space', 'advanced technology', 'year 3000', 'sci-fi setting'],
  'Fantasy World': ['fantasy world', 'magic realm', 'middle earth', 'imaginary world', 'narnia'],
  'Rural': ['rural', 'countryside', 'village', 'wilderness', 'forest', 'mountains', 'farm'],
  'Urban': ['urban', 'city', 'metropolis', 'downtown', 'london', 'new york', 'streets'],
  'Space': ['space', 'galaxy', 'interstellar', 'spaceship', 'orbit', 'stars'],
  'Ocean': ['ocean', 'sea', 'maritime', 'nautical', 'underwater', 'ship', 'island'],
  'Post-Apocalyptic': ['post-apocalyptic', 'apocalypse', 'dystopian', 'ruined world', 'wasteland'],
  'Alternate History': ['alternate history', 'what if', 'reimagined history'],
  'Mythological': ['mythological', 'mythology', 'gods', 'legends', 'zeus', 'greek myths'],

  // Themes
  'Coming of Age': ['coming of age', 'growing up', 'adolescence', 'school days', 'teenager', 'puberty'],
  'Identity & Self-Discovery': ['identity', 'self-discovery', 'who am i', 'finding oneself', 'identity crisis'],
  'Power & Politics': ['power', 'politics', 'government', 'conspiracy', 'empire', 'rebellion', 'ruler', 'senate'],
  'Survival': ['survival', 'surviving', 'wilderness survival', 'stranded', 'escape', 'against all odds'],
  'Love & Relationships': ['love', 'relationships', 'romance', 'marriage', 'affair', 'dating'],
  'Family Dynamics': ['family', 'parents', 'siblings', 'inheritance', 'mother', 'father', 'brother', 'sister'],
  'Friendship': ['friendship', 'friends', 'companionship', 'best friend', 'allies'],
  'Grief & Loss': ['grief', 'loss', 'death', 'mourning', 'bereavement', 'funeral'],
  'Morality & Ethics': ['morality', 'ethics', 'good and evil', 'moral dilemma', 'conscience'],
  'Nature & Environment': ['nature', 'environment', 'animals', 'climate change', 'ecology'],
  'War & Conflict': ['war', 'battle', 'military', 'soldier', 'combat', 'conflict', 'army'],
  'Technology & Society': ['technology', 'social media', 'robots', 'ai', 'machines', 'virtual reality'],
  'Religion & Faith': ['religion', 'faith', 'church', 'spirituality', 'god', 'belief', 'bible'],
  'Class & Inequality': ['class', 'inequality', 'poverty', 'wealth', 'social division', 'rich', 'poor'],
  'Mental Health': ['mental health', 'depression', 'anxiety', 'madness', 'psychology', 'trauma', 'therapy'],
  'Art & Creativity': ['art', 'writing', 'music', 'painting', 'creativity', 'theater', 'poetry'],
  'Crime & Justice': ['crime', 'justice', 'murder', 'law', 'detective', 'prison', 'thief', 'courtroom'],
  'Redemption': ['redemption', 'forgiveness', 'saving grace', 'second chance', 'atonement']
};

export function ruleTagBook(description: string, subjects: string[]): TagResult {
  const descLower = description.toLowerCase();
  const subsLower = subjects.map(s => s.toLowerCase());
  
  const result: TagResult = {
    mood: [],
    pace: [],
    setting: [],
    theme: [],
    genre: [],
    confidence: {}
  };

  const categories: TagCategory[] = ['mood', 'pace', 'setting', 'theme', 'genre'];

  for (const cat of categories) {
    const tagList = TAXONOMY[cat];
    for (const tag of tagList) {
      const keywords = KEYWORDS[tag] || [];
      let matchCount = 0;

      // 1. Check subjects (higher weight - immediate match if subject exactly matches keyword or tag name)
      const tagLower = tag.toLowerCase();
      if (subsLower.some(s => s.includes(tagLower) || tagLower.includes(s))) {
        matchCount += 3;
      }

      for (const kw of keywords) {
        if (subsLower.some(s => s === kw || s.includes(kw))) {
          matchCount += 3;
        }
      }

      // 2. Check description
      for (const kw of keywords) {
        // Count occurrences of keyword in description
        const regex = new RegExp(`\\b${kw}\\b`, 'g');
        const matches = descLower.match(regex);
        if (matches) {
          matchCount += matches.length;
        }
      }

      // If matches found
      if (matchCount > 0) {
        result[cat].push(tag);
        // Confidence calculation (logarithmic mapping to 0-1)
        const confidence = Math.min(0.5 + (matchCount / 10) * 0.4, 0.95);
        result.confidence[tag] = parseFloat(confidence.toFixed(2));
      }
    }
  }

  // ENFORCED RULE: Always return at least genre tags.
  // If no genre tag is matched, default to "Literary Fiction"
  if (result.genre.length === 0) {
    result.genre.push('Literary Fiction');
    result.confidence['Literary Fiction'] = 0.50;
  }

  // Limit tags per category to keep UI readable (e.g. max 5 per category)
  for (const cat of categories) {
    // Sort by confidence
    result[cat].sort((a, b) => (result.confidence[b] || 0) - (result.confidence[a] || 0));
    result[cat] = result[cat].slice(0, 5);
  }

  return result;
}
