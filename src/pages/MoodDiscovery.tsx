import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Trophy, Flame, Check, BookOpen, Info, FolderPlus, Shuffle, 
  LayoutGrid, Award, X 
} from 'lucide-react';
import { db } from '../db/schema';
import { TAXONOMY } from '../ml/taxonomy';
import BookCard from '../components/BookCard';


// Mood Category Color Map for background transition (low opacity rgba values)
const MOOD_COLORS: Record<string, string> = {
  'Cozy': 'rgba(158, 154, 111, 0.15)', // tag-pace/gold
  'Dark & Gritty': 'rgba(61, 53, 40, 0.25)', // border/charcoal
  'Melancholic': 'rgba(111, 139, 158, 0.15)', // tag-theme/steel
  'Uplifting': 'rgba(200, 169, 126, 0.15)', // primary/gold
  'Tense & Thrilling': 'rgba(207, 102, 121, 0.12)', // error/red
  'Whimsical': 'rgba(139, 111, 158, 0.15)', // tag-mood/violet
  'Thought-Provoking': 'rgba(123, 158, 135, 0.15)', // tag-setting/green
  'Heartwarming': 'rgba(158, 122, 111, 0.15)', // tag-genre/terracotta
  'Chilling': 'rgba(46, 40, 32, 0.2)', // surface-raised
  'Adventurous': 'rgba(122, 158, 111, 0.15)', // tag-setting/green
  'Romantic': 'rgba(158, 122, 111, 0.18)', // terracotta rose
  'Funny & Witty': 'rgba(168, 134, 90, 0.15)', // amber
  'Emotionally Heavy': 'rgba(111, 139, 158, 0.18)', // steel blue
  'Light & Breezy': 'rgba(123, 158, 135, 0.18)', // light sage
  'Nostalgic': 'rgba(200, 169, 126, 0.18)' // gold
};

const CURATED_COLORS = [
  { name: 'Gold', value: '#C8A97E' },
  { name: 'Sage', value: '#7B9E87' },
  { name: 'Terracotta', value: '#9E7A6F' },
  { name: 'Violet', value: '#8B6F9E' },
  { name: 'Steel', value: '#6F8B9E' },
  { name: 'Amber', value: '#A8865A' }
];

const CURATED_EMOJIS = [
  '📚', '📖', '✅', '🔖', '🌟', '❤️', '💡', '🎨', '🚀', '🔮', 
  '☕', '🍷', '🌲', '🌸', '🌞', '🌙', '📅', '🎭', '🎧', '🐾'
];

export default function MoodDiscovery() {
  const [activeTab, setActiveTab] = useState<'matcher' | 'today' | 'year'>('matcher');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📚');
  const [selectedColor, setSelectedColor] = useState(CURATED_COLORS[0]);
  const [saveToExisting, setSaveToExisting] = useState(false);
  const [targetShelfId, setTargetShelfId] = useState<number>(-1);

  // Year in Review states
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [readingGoal, setReadingGoal] = useState<number>(() => {
    const saved = localStorage.getItem(`shelf_reading_goal_${new Date().getFullYear()}`);
    return saved ? parseInt(saved, 10) : 12;
  });

  // Today Pick states
  const [reRollCount, setReRollCount] = useState(0);

  // Fetch Database tables
  const books = useLiveQuery(() => db.books.toArray()) || [];
  const bookTags = useLiveQuery(() => db.bookTags.toArray()) || [];
  const shelfBooks = useLiveQuery(() => db.shelfBooks.toArray()) || [];
  const shelves = useLiveQuery(() => db.shelves.toArray()) || [];
  const readingSessions = useLiveQuery(() => db.readingSessions.toArray()) || [];

  // 1. Mood Matcher Scoring & Live Calculations
  const tagsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    bookTags.forEach(t => map.set(t.bookId, t.tags));
    return map;
  }, [bookTags]);

  const shelfBooksMap = useMemo(() => {
    const map = new Map<string, typeof shelfBooks>();
    shelfBooks.forEach(sb => {
      const arr = map.get(sb.bookId) || [];
      arr.push(sb);
      map.set(sb.bookId, arr);
    });
    return map;
  }, [shelfBooks]);

  const matchedBooks = useMemo(() => {
    if (selectedMoods.length === 0) return [];

    const scored = books.map(book => {
      const tags = tagsMap.get(book.workId) || [];
      const overlaps = selectedMoods.filter(m => tags.includes(m));
      const score = overlaps.length / selectedMoods.length;

      // Extract details for secondary sorting
      const sbRecords = shelfBooksMap.get(book.workId) || [];
      const maxRating = sbRecords.reduce((max, r) => Math.max(max, r.rating || 0), 0);

      return {
        book,
        score,
        overlaps,
        maxRating
      };
    }).filter(item => item.score > 0);

    // Sort by: Score desc, Rating desc, Title asc
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.maxRating !== a.maxRating) return b.maxRating - a.maxRating;
      return a.book.title.localeCompare(b.book.title);
    });

    return scored;
  }, [books, selectedMoods, tagsMap, shelfBooksMap]);

  // Dynamic Background Gradients computation
  const backgroundStyle = useMemo(() => {
    if (selectedMoods.length === 0) {
      return { background: 'linear-gradient(135deg, var(--bg) 0%, var(--surface) 100%)' };
    }
    const colors = selectedMoods.map(m => MOOD_COLORS[m] || 'rgba(200, 169, 126, 0.05)');
    if (colors.length === 1) {
      return { background: `linear-gradient(135deg, ${colors[0]} 0%, var(--bg) 100%)` };
    }
    if (colors.length === 2) {
      return { background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)` };
    }
    return { background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)` };
  }, [selectedMoods]);

  // Handle Mood Toggle (Max 3)
  const handleMoodClick = (mood: string) => {
    setSelectedMoods(prev => {
      if (prev.includes(mood)) {
        return prev.filter(m => m !== mood);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), mood]; // FIFO rotation
      }
      return [...prev, mood];
    });
  };

  // Custom Shelves list filter
  const customShelves = useMemo(() => {
    return shelves.filter(s => !s.isSystem);
  }, [shelves]);

  // Pre-fill Save modal settings
  useEffect(() => {
    if (selectedMoods.length > 0) {
      setNewShelfName(`${selectedMoods.join(' & ')} Vibe`);
    } else {
      setNewShelfName('');
    }
  }, [selectedMoods]);

  const handleSaveSelection = async () => {
    if (matchedBooks.length === 0) return;

    let targetId = targetShelfId;

    if (!saveToExisting) {
      if (!newShelfName.trim()) return;
      // Add new shelf
      const newShelf = {
        name: newShelfName.trim().slice(0, 40),
        emoji: selectedEmoji,
        isSystem: false,
        createdAt: Date.now(),
        colorVal: selectedColor.value
      };
      targetId = await db.shelves.add(newShelf as any);
    }

    if (targetId === -1) return;

    // Link books to this shelf
    const addedAt = Date.now();
    for (const item of matchedBooks) {
      const bookId = item.book.workId;
      // check duplicates
      const existing = await db.shelfBooks
        .where({ shelfId: targetId, bookId })
        .first();
      if (!existing) {
        await db.shelfBooks.add({
          shelfId: targetId,
          bookId,
          addedAt
        });
      }
    }

    setIsSaveModalOpen(false);
    // Reset selection and redirect to shelf page or notify
    alert(`Added ${matchedBooks.length} books to list!`);
  };

  // 2. Reading Streak Tracker Calculation
  const streakStats = useMemo(() => {
    if (readingSessions.length === 0) {
      return { current: 0, longest: 0, hasReadToday: false };
    }

    // Sort unique dates ascending
    const uniqueDates = Array.from(new Set(readingSessions.map(s => s.date))).sort();
    const todayStr = new Date().toLocaleDateString('sv').split(' ')[0]; // YYYY-MM-DD
    
    // Yesterday YYYY-MM-DD
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('sv').split(' ')[0];

    const hasReadToday = uniqueDates.includes(todayStr);
    const hasReadYesterday = uniqueDates.includes(yesterdayStr);

    let current = 0;
    let longest = 0;

    if (hasReadToday || hasReadYesterday) {
      // Calculate current streak backward from today/yesterday
      let checkDate = hasReadToday ? new Date() : yesterday;
      while (true) {
        const checkStr = checkDate.toLocaleDateString('sv').split(' ')[0];
        if (uniqueDates.includes(checkStr)) {
          current++;
          // check day before
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate longest consecutive streak segment in all unique dates
    let currentSegment = 0;
    let prevDateTime: number | null = null;

    for (let i = 0; i < uniqueDates.length; i++) {
      const dateParts = uniqueDates[i].split('-').map(Number);
      const currTime = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getTime();

      if (prevDateTime === null) {
        currentSegment = 1;
      } else {
        const diffDays = Math.round((currTime - prevDateTime) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentSegment++;
        } else if (diffDays > 1) {
          longest = Math.max(longest, currentSegment);
          currentSegment = 1;
        }
      }
      prevDateTime = currTime;
    }
    longest = Math.max(longest, currentSegment);

    // Save to local storage for quick sync
    localStorage.setItem('shelf_streak_current', current.toString());
    localStorage.setItem('shelf_streak_longest', longest.toString());
    localStorage.setItem('shelf_streak_last_read_date', uniqueDates[uniqueDates.length - 1] || '');

    return { current, longest, hasReadToday };
  }, [readingSessions]);

  // 3. Daily Persistent Pick Recommendation
  const dailyPick = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('sv').split(' ')[0];
    const cachedDate = localStorage.getItem('shelf_daily_recommend_date');
    const cachedId = localStorage.getItem('shelf_daily_recommend_id');

    // Return cached recommendation if valid and not re-rolling
    if (cachedDate === todayStr && cachedId && reRollCount === 0) {
      const b = books.find(book => book.workId === cachedId);
      if (b) return b;
    }

    // Identify candidate books: Prefer "Want to Read" or "Reading"
    const wantToReadShelf = shelves.find(s => s.isSystem && s.name === 'Want to Read');
    const readingShelf = shelves.find(s => s.isSystem && s.name === 'Reading');
    const readShelf = shelves.find(s => s.isSystem && s.name === 'Read');

    const targetShelfIds = [wantToReadShelf?.id, readingShelf?.id].filter(Boolean) as number[];
    const readShelfId = readShelf?.id;

    // Filter shelfBooks to get books on Want to Read / Reading shelves
    const candidateIds = new Set(
      shelfBooks
        .filter(sb => targetShelfIds.includes(sb.shelfId))
        .map(sb => sb.bookId)
    );

    let candidates = books.filter(b => candidateIds.has(b.workId));

    // Fallback: If no candidate books, pick from all books except already "Read"
    if (candidates.length === 0) {
      const readBookIds = new Set(
        shelfBooks
          .filter(sb => sb.shelfId === readShelfId)
          .map(sb => sb.bookId)
      );
      candidates = books.filter(b => !readBookIds.has(b.workId));
    }

    // Secondary Fallback: Any book in library
    if (candidates.length === 0) {
      candidates = books;
    }

    if (candidates.length === 0) return null;

    // Select random book
    const index = Math.floor(Math.random() * candidates.length);
    const pick = candidates[index];

    // Cache pick
    localStorage.setItem('shelf_daily_recommend_date', todayStr);
    localStorage.setItem('shelf_daily_recommend_id', pick.workId);

    return pick;
  }, [books, shelves, shelfBooks, reRollCount]);

  const handleStartReadingDailyPick = async (bookId: string) => {
    const readingShelf = shelves.find(s => s.isSystem && s.name === 'Reading');
    if (!readingShelf) return;

    // Check if already on reading shelf
    const existing = await db.shelfBooks
      .where({ shelfId: readingShelf.id!, bookId })
      .first();

    if (!existing) {
      // Remove from 'Want to Read' or other system shelves first
      const systemIds = shelves.filter(s => s.isSystem).map(s => s.id!);
      await db.shelfBooks
        .where('bookId')
        .equals(bookId)
        .filter(sb => systemIds.includes(sb.shelfId))
        .delete();

      // Add to reading
      await db.shelfBooks.add({
        shelfId: readingShelf.id!,
        bookId,
        addedAt: Date.now(),
        startedAt: Date.now()
      });
    }

    // Go to reader or book detail
    window.location.hash = `#/book${bookId}`;
  };

  // 4. Year in Review Statistics Computations
  const yearStats = useMemo(() => {
    const targetYear = selectedYear;
    
    // Books read in targetYear
    const readShelf = shelves.find(s => s.isSystem && s.name === 'Read');
    const readShelfId = readShelf?.id;

    const finishedBooksThisYear = shelfBooks.filter(sb => {
      if (sb.shelfId !== readShelfId || !sb.finishedAt) return false;
      return new Date(sb.finishedAt).getFullYear() === targetYear;
    });

    const finishedBookIds = new Set(finishedBooksThisYear.map(sb => sb.bookId));
    const completedCount = finishedBooksThisYear.length;

    // Total pages read this year (sum from readingSessions in selectedYear)
    let totalPagesRead = 0;
    readingSessions.forEach(rs => {
      const sessionYear = new Date(rs.date).getFullYear();
      if (sessionYear === targetYear) {
        totalPagesRead += rs.pagesRead;
      }
    });

    // Books Read by Month
    const monthlyCounts = Array(12).fill(0);
    finishedBooksThisYear.forEach(sb => {
      const month = new Date(sb.finishedAt!).getMonth();
      monthlyCounts[month]++;
    });

    // Genre/Mood Breakdown of finished books
    const tagFrequencies: Record<string, number> = {};
    const genreFrequencies: Record<string, number> = {};

    books.forEach(b => {
      if (finishedBookIds.has(b.workId)) {
        // Mood / Theme tags
        const tags = tagsMap.get(b.workId) || [];
        tags.forEach(t => {
          tagFrequencies[t] = (tagFrequencies[t] || 0) + 1;
        });

        // Genres
        if (b.subjects && b.subjects.length > 0) {
          b.subjects.slice(0, 2).forEach(g => {
            genreFrequencies[g] = (genreFrequencies[g] || 0) + 1;
          });
        }
      }
    });

    // Sort breakdowns
    const topMoods = Object.entries(tagFrequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topGenres = Object.entries(genreFrequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      completedCount,
      totalPagesRead,
      monthlyCounts,
      topMoods,
      topGenres
    };
  }, [selectedYear, shelves, shelfBooks, readingSessions, books, tagsMap]);

  // Set goal helper
  const handleGoalChange = (val: number) => {
    setReadingGoal(val);
    localStorage.setItem(`shelf_reading_goal_${selectedYear}`, val.toString());
  };

  // 5. Heatmap Grid Data generator
  const heatmapData = useMemo(() => {
    const year = selectedYear;
    const firstDay = new Date(year, 0, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 is Sunday, 6 Saturday
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInYear = isLeap ? 366 : 365;

    // Create session pages map
    const sessionsMap = new Map<string, number>();
    readingSessions.forEach(rs => {
      sessionsMap.set(rs.date, (sessionsMap.get(rs.date) || 0) + rs.pagesRead);
    });

    const cells = [];
    for (let i = 0; i < daysInYear; i++) {
      const dateObj = new Date(year, 0, 1 + i);
      const dateStr = dateObj.toLocaleDateString('sv').split(' ')[0]; // YYYY-MM-DD
      const pages = sessionsMap.get(dateStr) || 0;
      
      const totalDaysSinceStart = i + startDayOfWeek;
      const weekIdx = Math.floor(totalDaysSinceStart / 7);
      const dayIdx = totalDaysSinceStart % 7;

      cells.push({
        date: dateStr,
        pages,
        week: weekIdx,
        day: dayIdx,
        month: dateObj.getMonth(),
        label: `${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${pages} pages read`
      });
    }

    return cells;
  }, [selectedYear, readingSessions]);

  // Unique years list for review
  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    shelfBooks.forEach(sb => {
      if (sb.finishedAt) years.add(new Date(sb.finishedAt).getFullYear());
    });
    readingSessions.forEach(rs => {
      const y = new Date(rs.date).getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [shelfBooks, readingSessions]);

  return (
    <div 
      className="w-full min-h-full transition-all duration-1000 px-6 py-8 md:px-10 md:py-12 max-w-7xl mx-auto flex flex-col gap-8 pb-20 md:pb-12"
      style={activeTab === 'matcher' ? backgroundStyle : {}}
    >
      {/* Header Panel */}
      <div className="flex justify-between items-start shrink-0">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-text-primary tracking-tight">
            Discover
          </h1>
          <p className="text-text-secondary text-sm md:text-base mt-2 font-sans">
            Find the right book for your vibe, check your streak, and view reading stats.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-surface border border-border/80 rounded-xl p-1 shrink-0 font-sans shadow-sm text-xs font-semibold">
          <button 
            onClick={() => setActiveTab('matcher')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 focus:outline-none ${
              activeTab === 'matcher' ? 'bg-primary text-bg' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Mood Matcher</span>
          </button>
          <button 
            onClick={() => setActiveTab('today')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 focus:outline-none ${
              activeTab === 'today' ? 'bg-primary text-bg' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Flame size={14} />
            <span className="hidden sm:inline">Pick for Today</span>
          </button>
          <button 
            onClick={() => setActiveTab('year')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 focus:outline-none ${
              activeTab === 'year' ? 'bg-primary text-bg' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Trophy size={14} />
            <span className="hidden sm:inline">Year in Review</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: MOOD MATCHER */}
        {activeTab === 'matcher' && (
          <motion.div
            key="matcher"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-6"
          >
            {/* Mood selector card */}
            <div className="bg-surface/60 backdrop-blur-md border border-border/60 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-primary" />
                <h2 className="font-serif text-lg font-bold text-text-primary">What are you in the mood for?</h2>
                <span className="text-[10px] text-text-secondary font-mono ml-auto">SELECT 1 TO 3 MOODS</span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {TAXONOMY.mood.map(mood => {
                  const isSelected = selectedMoods.includes(mood);
                  return (
                    <button
                      key={mood}
                      onClick={() => handleMoodClick(mood)}
                      className={`px-4 py-2 rounded-full border text-xs font-semibold tracking-wide transition-all ${
                        isSelected 
                          ? 'bg-primary text-bg border-primary shadow-md scale-102 font-bold' 
                          : 'bg-surface-raised/40 hover:bg-surface-raised border-border/40 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {mood}
                    </button>
                  );
                })}
              </div>

              {selectedMoods.length > 0 && (
                <div className="flex justify-between items-center border-t border-border/20 pt-4 mt-2 shrink-0">
                  <span className="text-xs text-text-secondary font-sans">
                    Showing matches for: <strong className="text-text-primary font-bold">{selectedMoods.join(', ')}</strong>
                  </span>
                  <button 
                    onClick={() => setSelectedMoods([])}
                    className="text-xs text-error hover:text-error/85 transition-colors font-semibold"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>

            {/* Match output list */}
            {selectedMoods.length === 0 ? (
              <div className="py-16 border border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-surface/30">
                <Sparkles className="h-10 w-10 text-primary/45 mb-3 stroke-[1.2]" />
                <h3 className="font-serif text-base font-semibold text-text-primary">No moods selected</h3>
                <p className="text-text-secondary text-xs max-w-sm mt-1">
                  Select up to three moods above to filter and score books in your library that match the aesthetic.
                </p>
              </div>
            ) : matchedBooks.length === 0 ? (
              <div className="py-16 border border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-surface/30">
                <LayoutGrid className="h-10 w-10 text-text-secondary/40 mb-3 stroke-[1.2]" />
                <h3 className="font-serif text-base font-semibold text-text-primary">No matching books</h3>
                <p className="text-text-secondary text-xs max-w-sm mt-1">
                  No books in your library are tagged with the selected moods. Try tagging books inside details pages or add new books.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-border/30 pb-3">
                  <h3 className="font-serif text-lg font-bold text-text-primary">
                    Matches ({matchedBooks.length})
                  </h3>
                  <button
                    onClick={() => setIsSaveModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-sans text-primary hover:text-primary-hover font-semibold transition-colors focus:outline-none border border-primary/20 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-raised"
                  >
                    <FolderPlus size={14} />
                    <span>Save vibe as list</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {matchedBooks.map(({ book, score }) => (
                    <div key={book.workId} className="relative group">
                      <BookCard book={book} />
                      {/* Matching score display badge */}
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-primary text-bg font-sans font-bold text-[9px] uppercase tracking-wider shadow z-20 pointer-events-none select-none">
                        {Math.round(score * 100)}% Match
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: PICK FOR TODAY */}
        {activeTab === 'today' && (
          <motion.div
            key="today"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Streak & Activity Tracker */}
            <div className="flex flex-col gap-6 lg:col-span-1">
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-5">
                <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                  <Flame className="h-5 w-5 text-primary stroke-[1.8]" />
                  <h2 className="font-serif text-lg font-bold text-text-primary">Your Streak</h2>
                </div>

                <div className="flex items-center gap-5 justify-center py-4">
                  <div className="relative flex items-center justify-center">
                    {/* Glowing effect */}
                    <div className={`absolute inset-0 bg-primary/25 rounded-full blur-xl scale-75 transition-opacity ${
                      streakStats.current > 0 ? 'opacity-100' : 'opacity-0'
                    }`} />
                    
                    <div className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center z-10 ${
                      streakStats.current > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary'
                    }`}>
                      <Flame className={`h-8 w-8 ${streakStats.current > 0 ? 'fill-primary animate-pulse' : ''}`} />
                      <span className="font-mono text-lg font-bold mt-0.5 leading-none">{streakStats.current}</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <span className="font-serif text-xl font-bold text-text-primary">
                      {streakStats.current}-Day Streak
                    </span>
                    <span className="font-sans text-xs text-text-secondary mt-1">
                      {streakStats.hasReadToday 
                        ? 'Awesome! Streak active for today.' 
                        : 'Read today to keep the flame alive.'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-border/30 pt-4 shrink-0 font-mono text-center">
                  <div className="bg-surface-raised/40 p-2.5 rounded-xl border border-border/35">
                    <span className="text-[10px] text-text-secondary uppercase block mb-1">LONGEST STREAK</span>
                    <span className="text-sm font-bold text-text-primary">{streakStats.longest} days</span>
                  </div>
                  <div className="bg-surface-raised/40 p-2.5 rounded-xl border border-border/35">
                    <span className="text-[10px] text-text-secondary uppercase block mb-1">DAYS READ</span>
                    <span className="text-sm font-bold text-text-primary">
                      {Array.from(new Set(readingSessions.map(s => s.date))).length} days
                    </span>
                  </div>
                </div>
              </div>

              {/* Reading tip card */}
              <div className="bg-surface/50 border border-border/60 rounded-2xl p-5 shadow-sm text-xs text-text-secondary flex flex-col gap-2">
                <span className="font-mono font-bold text-primary text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Award size={12} /> Pro Tip
                </span>
                <p className="font-sans leading-relaxed">
                  Log your reading progress inside the Reader or Book details page. Even reading 1 page keeps your consecutive reading streak going!
                </p>
              </div>
            </div>

            {/* Daily Recommendation Pick */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  <h2 className="font-serif text-lg font-bold text-text-primary">Pick for Today</h2>
                </div>
                <button
                  onClick={() => setReRollCount(prev => prev + 1)}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary font-semibold transition-colors focus:outline-none"
                  title="Generate another book suggestion"
                >
                  <Shuffle size={13} />
                  <span>Choose Another</span>
                </button>
              </div>

              {dailyPick ? (
                <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-stretch">
                  {/* Book Cover */}
                  <div className="w-full md:w-40 aspect-[2/3] shrink-0 rounded-xl overflow-hidden border border-border bg-surface-raised shadow relative flex items-center justify-center">
                    {dailyPick.coverUrl ? (
                      <img 
                        src={dailyPick.coverUrl} 
                        alt={dailyPick.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4">
                        <span className="font-serif text-xs font-bold text-primary truncate max-w-full px-1">{dailyPick.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Book details metadata */}
                  <div className="flex-1 flex flex-col justify-between py-1 gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {tagsMap.get(dailyPick.workId)?.slice(0, 3).map(t => (
                          <span key={t} className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-sans font-bold text-primary">
                            {t}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-serif text-2xl font-bold text-text-primary leading-tight">
                        {dailyPick.title}
                      </h3>
                      <p className="font-sans text-sm text-text-secondary mt-0.5">
                        by {dailyPick.authors?.join(', ') || 'Unknown Author'}
                      </p>
                      
                      {dailyPick.description && (
                        <p className="font-sans text-xs text-text-secondary/85 leading-relaxed line-clamp-4 mt-2">
                          {typeof dailyPick.description === 'string' 
                            ? dailyPick.description 
                            : (dailyPick.description as any).value || 'No description available.'}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4 shrink-0">
                      <button
                        onClick={() => handleStartReadingDailyPick(dailyPick.workId)}
                        className="px-5 py-2.5 rounded-xl bg-primary text-bg font-sans font-bold text-xs hover:bg-primary-hover active:scale-[0.98] transition-all shadow"
                      >
                        Start Reading
                      </button>
                      <button
                        onClick={() => window.location.hash = `#/book${dailyPick.workId}`}
                        className="px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-xs text-text-primary font-bold hover:bg-border/20 transition-all"
                      >
                        View Book Details
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 border border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-surface/30">
                  <BookOpen className="h-10 w-10 text-text-secondary/40 mb-3 stroke-[1.2]" />
                  <h3 className="font-serif text-base font-semibold text-text-primary">Your Library is Empty</h3>
                  <p className="text-text-secondary text-xs max-w-sm mt-1">
                    Add books to your library to receive daily customized recommendations.
                  </p>
                  <button
                    onClick={() => window.location.hash = '#/search'}
                    className="mt-4 px-4 py-2 rounded-xl bg-surface border border-border text-xs text-primary font-bold hover:text-primary-hover active:scale-[0.98] transition-all focus:outline-none"
                  >
                    Search books
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 3: YEAR IN REVIEW */}
        {activeTab === 'year' && (
          <motion.div
            key="year"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-8"
          >
            {/* Year Selector and Goal Config Header */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-text-secondary">SELECT YEAR</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="bg-surface-raised border border-border rounded-lg text-sm px-3.5 py-2 font-mono text-text-primary focus:outline-none focus:border-primary"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              {/* Goal Setter slider */}
              <div className="flex flex-col gap-1.5 max-w-xs w-full">
                <div className="flex justify-between items-baseline text-[10px] font-mono text-text-secondary/60">
                  <span>ANNUAL READING GOAL</span>
                  <span className="text-primary font-bold">{readingGoal} Books</span>
                </div>
                <input 
                  type="range"
                  min={1}
                  max={100}
                  value={readingGoal}
                  onChange={(e) => handleGoalChange(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            {/* Core Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
              {/* Circular SVG Gauge for Goal Achievement */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center gap-4">
                <h3 className="font-serif text-sm font-semibold text-text-secondary">Reading Goal</h3>
                
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    {/* Background circle track */}
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      className="stroke-border/40"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    {/* Foreground goal progress */}
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      className="stroke-primary"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 - (Math.min(yearStats.completedCount, readingGoal) / readingGoal) * (2 * Math.PI * 50)}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Inside Text */}
                  <div className="absolute flex flex-col items-center">
                    <span className="font-mono text-2xl font-bold text-text-primary">{yearStats.completedCount}</span>
                    <span className="font-sans text-[10px] text-text-secondary uppercase">of {readingGoal} read</span>
                  </div>
                </div>

                <span className="font-sans text-xs text-text-secondary mt-1">
                  {yearStats.completedCount >= readingGoal 
                    ? 'Trophy earned! Goal reached! 🎉' 
                    : `${readingGoal - yearStats.completedCount} more books to reach your goal.`}
                </span>
              </div>

              {/* Monthly SVG Bar Chart */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4 md:col-span-2">
                <div className="flex justify-between items-baseline border-b border-border/20 pb-2">
                  <h3 className="font-serif text-sm font-semibold text-text-secondary">Books Completed by Month</h3>
                  <span className="font-mono text-xs text-text-primary">{yearStats.completedCount} books total</span>
                </div>
                
                {/* SVG Bar chart body */}
                <div className="w-full flex-1 flex items-end justify-center min-h-36 pt-4">
                  {yearStats.completedCount > 0 ? (
                    <div className="w-full h-full flex flex-col justify-between">
                      <svg viewBox="0 0 540 120" className="w-full h-28">
                        {/* Render bars */}
                        {(() => {
                          const maxCount = Math.max(...yearStats.monthlyCounts, 1);
                          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          const barWidth = 24;
                          const spacing = 18;
                          const startX = 20;

                          return yearStats.monthlyCounts.map((count, i) => {
                            const barHeight = (count / maxCount) * 80;
                            const x = startX + i * (barWidth + spacing);
                            const y = 90 - barHeight;
                            
                            return (
                              <g key={i} className="group cursor-pointer">
                                {/* Bar */}
                                <rect
                                  x={x}
                                  y={y}
                                  width={barWidth}
                                  height={barHeight}
                                  rx="2"
                                  className="fill-primary/60 hover:fill-primary transition-colors"
                                />
                                {/* Value tooltip on top */}
                                {count > 0 && (
                                  <text
                                    x={x + barWidth / 2}
                                    y={y - 5}
                                    textAnchor="middle"
                                    className="font-mono text-[9px] fill-text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    {count}
                                  </text>
                                )}
                                {/* Label */}
                                <text
                                  x={x + barWidth / 2}
                                  y={110}
                                  textAnchor="middle"
                                  className="font-mono text-[9px] fill-text-secondary"
                                >
                                  {months[i]}
                                </text>
                              </g>
                            );
                          });
                        })()}
                      </svg>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-xs text-text-secondary italic">
                      No books read in {selectedYear} yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Heatmap & Donut Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Genre / Mood Donut Chart */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4 lg:col-span-1">
                <h3 className="font-serif text-sm font-semibold text-text-secondary border-b border-border/20 pb-2">
                  Top Genres & Moods Read
                </h3>

                {yearStats.completedCount > 0 && (yearStats.topGenres.length > 0 || yearStats.topMoods.length > 0) ? (
                  <div className="flex flex-col gap-5 py-2">
                    {/* Genre list breakdown */}
                    {yearStats.topGenres.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="font-mono text-[10px] text-text-secondary/70 uppercase">GENRES IN {selectedYear}</span>
                        <div className="flex flex-col gap-1.5 font-sans text-xs">
                          {yearStats.topGenres.map(([genre, count]) => {
                            const percent = Math.round((count / yearStats.completedCount) * 100);
                            return (
                              <div key={genre} className="flex justify-between items-center bg-surface-raised/40 border border-border/30 px-3 py-1.5 rounded-lg">
                                <span className="font-medium text-text-primary truncate max-w-40">{genre}</span>
                                <span className="font-mono text-primary font-bold">{percent}% ({count})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mood list breakdown */}
                    {yearStats.topMoods.length > 0 && (
                      <div className="flex flex-col gap-2 mt-2">
                        <span className="font-mono text-[10px] text-text-secondary/70 uppercase">MOODS IN {selectedYear}</span>
                        <div className="flex flex-col gap-1.5 font-sans text-xs">
                          {yearStats.topMoods.map(([mood, count]) => {
                            const percent = Math.round((count / yearStats.completedCount) * 100);
                            return (
                              <div key={mood} className="flex justify-between items-center bg-surface-raised/40 border border-border/30 px-3 py-1.5 rounded-lg">
                                <span className="font-medium text-text-primary truncate max-w-40">{mood}</span>
                                <span className="font-mono text-primary font-bold">{percent}% ({count})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center flex-1 min-h-36 text-xs text-text-secondary italic">
                    No data to represent.
                  </div>
                )}
              </div>

              {/* Contribution heat map grid */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4 lg:col-span-2">
                <div className="flex justify-between items-baseline border-b border-border/20 pb-2">
                  <h3 className="font-serif text-sm font-semibold text-text-secondary">Reading Consistency Heatmap</h3>
                  <span className="font-mono text-xs text-text-primary">{yearStats.totalPagesRead} pages read</span>
                </div>

                <div className="w-full overflow-x-auto hide-scrollbar pt-2">
                  <div className="min-w-[650px] flex flex-col gap-1">
                    {/* SVG Contribution Graph Grid */}
                    <svg viewBox="0 0 740 98" className="w-full h-24">
                      {/* Grid cells */}
                      {heatmapData.map((cell, idx) => {
                        const x = cell.week * 14;
                        const y = cell.day * 14;
                        
                        // Pick color based on pages read
                        let color = '#252018'; // surface/empty
                        let border = '#2E2820'; // surface border
                        if (cell.pages > 0 && cell.pages <= 20) {
                          color = 'rgba(200, 169, 126, 0.18)'; // 15% gold
                          border = 'rgba(200, 169, 126, 0.3)';
                        } else if (cell.pages > 20 && cell.pages <= 50) {
                          color = 'rgba(200, 169, 126, 0.45)'; // 40% gold
                          border = 'rgba(200, 169, 126, 0.55)';
                        } else if (cell.pages > 50 && cell.pages <= 100) {
                          color = 'rgba(200, 169, 126, 0.75)'; // 70% gold
                          border = 'rgba(200, 169, 126, 0.85)';
                        } else if (cell.pages > 100) {
                          color = '#C8A97E'; // 100% gold
                          border = '#A8865A';
                        }

                        return (
                          <rect
                            key={idx}
                            x={x}
                            y={y}
                            width="10"
                            height="10"
                            rx="1.5"
                            fill={color}
                            stroke={border}
                            strokeWidth="0.5"
                            className="transition-colors hover:stroke-primary hover:stroke-[1.5px]"
                          >
                            <title>{cell.label}</title>
                          </rect>
                        );
                      })}
                    </svg>

                    {/* Heatmap Legend */}
                    <div className="flex justify-between items-center text-[9px] font-mono text-text-secondary px-1 mt-1">
                      <div className="flex gap-4">
                        <span>Jan</span>
                        <span>Mar</span>
                        <span>May</span>
                        <span>Jul</span>
                        <span>Sep</span>
                        <span>Nov</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>Less</span>
                        <div className="w-2.5 h-2.5 rounded bg-[#252018] border border-[#2E2820]" />
                        <div className="w-2.5 h-2.5 rounded bg-[rgba(200,169,126,0.18)] border border-[rgba(200,169,126,0.3)]" />
                        <div className="w-2.5 h-2.5 rounded bg-[rgba(200,169,126,0.45)] border border-[rgba(200,169,126,0.55)]" />
                        <div className="w-2.5 h-2.5 rounded bg-[rgba(200,169,126,0.75)] border border-[rgba(200,169,126,0.85)]" />
                        <div className="w-2.5 h-2.5 rounded bg-[#C8A97E] border border-[#A8865A]" />
                        <span>More</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Selection to Custom Shelf Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaveModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              className="relative w-full max-w-md bg-surface-raised border border-border rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-5 overflow-hidden font-sans"
            >
              <div className="flex justify-between items-center border-b border-border/40 pb-3">
                <h3 className="font-serif text-lg font-bold text-text-primary">Save Matches as Shelf</h3>
                <button
                  onClick={() => setIsSaveModalOpen(false)}
                  className="text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Toggle new vs existing */}
              {customShelves.length > 0 && (
                <div className="flex bg-surface border border-border/60 rounded-xl p-1 shrink-0 text-xs font-semibold text-center mb-1">
                  <button
                    onClick={() => setSaveToExisting(false)}
                    className={`flex-1 py-1.5 rounded-lg transition-colors focus:outline-none ${
                      !saveToExisting ? 'bg-primary text-bg' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Create New List
                  </button>
                  <button
                    onClick={() => setSaveToExisting(true)}
                    className={`flex-1 py-1.5 rounded-lg transition-colors focus:outline-none ${
                      saveToExisting ? 'bg-primary text-bg' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Add to Existing List
                  </button>
                </div>
              )}

              {saveToExisting ? (
                /* Select Custom Shelf Dropdown */
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider">SELECT LIST</label>
                  <select
                    value={targetShelfId}
                    onChange={(e) => setTargetShelfId(parseInt(e.target.value, 10))}
                    className="w-full bg-surface border border-border rounded-xl text-sm p-3.5 focus:outline-none focus:border-primary text-text-primary"
                  >
                    <option value={-1}>-- Choose Shelf --</option>
                    {customShelves.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.emoji} {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Create custom shelf settings */
                <div className="flex flex-col gap-4">
                  {/* Name Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider">LIST NAME</label>
                    <input
                      type="text"
                      maxLength={40}
                      value={newShelfName}
                      onChange={(e) => setNewShelfName(e.target.value)}
                      placeholder="List Name"
                      className="w-full bg-surface border border-border rounded-xl text-sm p-3.5 focus:outline-none focus:border-primary text-text-primary font-sans"
                    />
                    <span className="text-[10px] text-text-secondary self-end">{newShelfName.length}/40</span>
                  </div>

                  {/* Curated Emoji Picker */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-baseline">
                      <label className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider">CHOOSE EMOJI</label>
                      <span className="text-xl select-none bg-surface p-1 rounded border border-border">{selectedEmoji}</span>
                    </div>
                    <div className="grid grid-cols-10 gap-1.5 max-h-24 overflow-y-auto pr-1 border border-border/40 p-2 rounded-xl bg-surface">
                      {CURATED_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setSelectedEmoji(emoji)}
                          className={`text-base p-1 rounded transition-colors select-none flex items-center justify-center hover:bg-surface-raised ${
                            selectedEmoji === emoji ? 'bg-primary/20 border border-primary/40' : 'border border-transparent'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accent Color Picker */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider">COLOR ACCENT</label>
                    <div className="flex justify-between gap-2.5 p-2 rounded-xl bg-surface border border-border/40">
                      {CURATED_COLORS.map((color) => (
                        <button
                          key={color.name}
                          onClick={() => setSelectedColor(color)}
                          className="w-7 h-7 rounded-full border border-border/75 flex items-center justify-center relative hover:scale-105 active:scale-95 transition-transform focus:outline-none"
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        >
                          {selectedColor.name === color.name && (
                            <Check className="h-3 w-3 text-bg stroke-[3.5]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="flex gap-3 mt-2 shrink-0">
                <button
                  onClick={() => setIsSaveModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-surface border border-border font-sans font-bold text-sm text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSelection}
                  disabled={saveToExisting ? targetShelfId === -1 : !newShelfName.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary text-bg font-sans font-bold text-sm hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all focus:outline-none shadow"
                >
                  Save matches
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
