import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calendar, Star, FolderPlus, Plus, X, ListPlus, Check } from 'lucide-react';
import { db } from '../db/schema';
import ShelfRow from '../components/ShelfRow';
import type { Book } from '../types/book';

// Curated 40 emojis for list personalization
const CURATED_EMOJIS = [
  '📚', '📖', '✅', '🔖', '📓', '📔', '🗂️', '📂', '❤️', '🌟', 
  '🍀', '💡', '🎨', '✈️', '🏝️', '🏠', '🧩', '🚀', '🔮', '☕', 
  '🍷', '🌲', '🌸', '🌞', '🌙', '📅', '📝', '🔒', '👥', '💼', 
  '🎓', '🎭', '🎧', '🎬', '🏆', '⚓', '🏜️', '🏔️', '🪐', '🐾'
];

// Curated 6 warm color accents
const CURATED_COLORS = [
  { name: 'Gold', value: '#C8A97E', text: 'text-[#C8A97E]', bg: 'bg-[#C8A97E]/10', border: 'border-[#C8A97E]/30' },
  { name: 'Sage', value: '#7B9E87', text: 'text-[#7B9E87]', bg: 'bg-[#7B9E87]/10', border: 'border-[#7B9E87]/30' },
  { name: 'Terracotta', value: '#9E7A6F', text: 'text-[#9E7A6F]', bg: 'bg-[#9E7A6F]/10', border: 'border-[#9E7A6F]/30' },
  { name: 'Violet', value: '#8B6F9E', text: 'text-[#8B6F9E]', bg: 'bg-[#8B6F9E]/10', border: 'border-[#8B6F9E]/30' },
  { name: 'Steel', value: '#6F8B9E', text: 'text-[#6F8B9E]', bg: 'bg-[#6F8B9E]/10', border: 'border-[#6F8B9E]/30' },
  { name: 'Amber', value: '#A8865A', text: 'text-[#A8865A]', bg: 'bg-[#A8865A]/10', border: 'border-[#A8865A]/30' }
];

export default function Shelf() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📚');
  const [selectedColor, setSelectedColor] = useState(CURATED_COLORS[0]);

  // Query 1: Calculate Reading Stats
  const stats = useLiveQuery(async () => {
    const allShelves = await db.shelves.toArray();
    const readShelf = allShelves.find(s => s.isSystem && s.name === 'Read');
    const allShelfBooks = await db.shelfBooks.toArray();
    
    let totalRead = 0;
    let readThisYear = 0;
    let totalRating = 0;
    let ratedCount = 0;
    const currentYear = new Date().getFullYear();

    allShelfBooks.forEach(sb => {
      // Books on the system 'Read' shelf
      if (readShelf && sb.shelfId === readShelf.id) {
        totalRead++;
        if (sb.finishedAt) {
          const finishedYear = new Date(sb.finishedAt).getFullYear();
          if (finishedYear === currentYear) {
            readThisYear++;
          }
        }
      }
      if (sb.rating && sb.rating > 0) {
        totalRating += sb.rating;
        ratedCount++;
      }
    });

    const avgRating = ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : '0.0';

    return { totalRead, readThisYear, avgRating };
  });

  // Query 2: Fetch System Shelves & Join Books
  const systemShelvesData = useLiveQuery(async () => {
    const allShelves = await db.shelves.toArray();
    const allShelfBooks = await db.shelfBooks.toArray();
    const allBooks = await db.books.toArray();
    const system = allShelves.filter(s => s.isSystem);

    const map: Record<number, Book[]> = {};
    system.forEach(s => {
      const sbMatches = allShelfBooks.filter(sb => sb.shelfId === s.id);
      const bookIds = new Set(sbMatches.map(sb => sb.bookId));
      map[s.id!] = allBooks.filter(b => bookIds.has(b.workId));
    });

    return {
      shelves: system,
      booksMap: map
    };
  });

  // Query 3: Fetch Custom Lists & Details (Stack of first 3 covers)
  const customLists = useLiveQuery(async () => {
    const allShelves = await db.shelves.toArray();
    const allShelfBooks = await db.shelfBooks.toArray();
    const allBooks = await db.books.toArray();
    const custom = allShelves.filter(s => !s.isSystem);

    // Custom shelf color accents could be stored in a separate property or fallback.
    // For simplicity, we can dynamically hash or assign a color theme if not stored.
    // Let's store custom shelf color values as custom properties on the shelf object!
    // Since Dexie schema allows any properties, we can save: colorVal and emoji.
    return custom.map(shelf => {
      const sbMatches = allShelfBooks.filter(sb => sb.shelfId === shelf.id);
      // Sort by addedAt desc to get recently added first
      sbMatches.sort((a, b) => b.addedAt - a.addedAt);
      const bookIds = sbMatches.map(sb => sb.bookId);

      const shelfBooksList = allBooks.filter(b => bookIds.includes(b.workId));
      // Sort to match order of bookIds
      const sortedBooks = bookIds
        .map(id => shelfBooksList.find(b => b.workId === id))
        .filter(Boolean) as Book[];

      // Retrieve stored color or fallback
      const colorVal = (shelf as any).colorVal || CURATED_COLORS[0].value;
      const colorTheme = CURATED_COLORS.find(c => c.value === colorVal) || CURATED_COLORS[0];

      return {
        shelf,
        books: sortedBooks,
        count: sbMatches.length,
        colorTheme,
        covers: sortedBooks.slice(0, 3).map(b => b.coverUrl).filter(Boolean) as string[]
      };
    });
  });

  // Query 4: PDF page progress map
  const progressMap = useLiveQuery(async () => {
    const pdfs = await db.pdfFiles.toArray();
    const map: Record<string, number> = {};
    pdfs.forEach(p => {
      if (p.totalPages > 0) {
        map[p.bookId] = Math.round((p.lastPage / p.totalPages) * 100);
      }
    });
    return map;
  }) || {};

  // Handle New Shelf Submit
  const handleCreateShelf = async () => {
    if (!newShelfName.trim()) return;
    
    await db.shelves.add({
      name: newShelfName.trim().slice(0, 40),
      emoji: selectedEmoji,
      isSystem: false,
      createdAt: Date.now(),
      // Custom properties
      colorVal: selectedColor.value
    } as any);

    // Reset fields
    setNewShelfName('');
    setSelectedEmoji('📚');
    setSelectedColor(CURATED_COLORS[0]);
    setIsModalOpen(false);
  };

  return (
    <div className="w-full min-h-full px-6 py-8 md:px-10 md:py-12 max-w-7xl mx-auto flex flex-col gap-8 pb-20 md:pb-12">
      {/* Page Header */}
      <div className="flex justify-between items-start shrink-0">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-text-primary tracking-tight">
            Library Shelves
          </h1>
          <p className="text-text-secondary text-sm md:text-base mt-2 font-sans">
            Manage your personal bookshelf reading logs and custom lists.
          </p>
        </div>
        <Link
          to="/tags"
          className="text-xs font-sans font-semibold text-primary hover:text-primary-hover flex items-center gap-1.5 border border-primary/20 px-3 py-2 rounded-lg bg-surface hover:bg-surface-raised transition-all"
        >
          Browse tags
        </Link>
      </div>

      {/* Reading Stats Card */}
      {stats && (
        <div className="grid grid-cols-3 bg-surface border border-border/80 rounded-2xl p-5 shadow-sm divide-x divide-border/30 shrink-0">
          <div className="flex flex-col items-center justify-center p-2 text-center">
            <BookOpen className="h-4 w-4 text-primary mb-1.5 stroke-[1.5]" />
            <span className="text-lg md:text-2xl font-mono font-bold text-text-primary">{stats.totalRead}</span>
            <span className="text-[10px] md:text-xs text-text-secondary uppercase tracking-wider mt-1 font-medium">READ</span>
          </div>
          
          <div className="flex flex-col items-center justify-center p-2 text-center">
            <Calendar className="h-4 w-4 text-primary mb-1.5 stroke-[1.5]" />
            <span className="text-lg md:text-2xl font-mono font-bold text-text-primary">{stats.readThisYear}</span>
            <span className="text-[10px] md:text-xs text-text-secondary uppercase tracking-wider mt-1 font-medium">THIS YEAR</span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 text-center">
            <Star className="h-4 w-4 text-primary mb-1.5 stroke-[1.5]" />
            <span className="text-lg md:text-2xl font-mono font-bold text-text-primary">{stats.avgRating}</span>
            <span className="text-[10px] md:text-xs text-text-secondary uppercase tracking-wider mt-1 font-medium">AVG RATING</span>
          </div>
        </div>
      )}

      {/* System Shelves Sections */}
      <div className="flex flex-col">
        {systemShelvesData?.shelves.map((shelf) => {
          const shelfBooksList = systemShelvesData.booksMap[shelf.id!] || [];
          return (
            <ShelfRow
              key={shelf.id}
              shelfId={shelf.id!}
              name={shelf.name}
              emoji={shelf.emoji}
              books={shelfBooksList}
              progressMap={progressMap}
            />
          );
        })}
      </div>

      {/* Custom Lists (My Lists) Section */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-baseline border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary stroke-[1.5]" />
            <h2 className="font-serif text-xl font-bold text-text-primary">My Custom Lists</h2>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-sans text-primary hover:text-primary-hover font-semibold transition-colors focus:outline-none"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New List</span>
          </button>
        </div>

        {customLists && customLists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customLists.map(({ shelf, count, colorTheme, covers }) => (
              <Link
                key={shelf.id}
                to={`/shelf/${shelf.id}`}
                className={`flex justify-between items-center p-5 rounded-2xl border bg-surface hover:bg-surface-raised transition-all duration-200 group ${colorTheme.border} hover:border-primary/40 shadow-sm`}
              >
                <div className="flex flex-col gap-1.5 max-w-[60%]">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl select-none">{shelf.emoji}</span>
                    <h3 className="font-serif text-base font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                      {shelf.name}
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-text-secondary">
                    {count} book{count === 1 ? '' : 's'}
                  </span>
                </div>

                {/* 3-Card Stack Cover Pile */}
                <div className="relative w-20 h-16 mr-3 shrink-0 flex items-center justify-end">
                  {covers.length > 0 ? (
                    covers.map((url, i) => (
                      <div
                        key={i}
                        className="absolute w-10 h-15 rounded border border-border/70 overflow-hidden shadow-md bg-surface transition-transform duration-200"
                        style={{
                          backgroundImage: `url(${url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          right: `${i * 12}px`,
                          zIndex: 10 - i,
                          transform: `rotate(${(i - 1) * 3}deg) translateY(${i * 1.5}px)`,
                        }}
                      />
                    ))
                  ) : (
                    <div className="w-10 h-15 rounded border border-dashed border-border/40 flex items-center justify-center text-[10px] text-text-secondary select-none">
                      Empty
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-12 border border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-6">
            <FolderPlus className="h-10 w-10 text-text-secondary/40 mb-3 stroke-[1.2]" />
            <h3 className="font-serif text-sm font-semibold text-text-primary">No custom lists created</h3>
            <p className="text-text-secondary text-xs max-w-xs mt-1">
              Create lists to organize your reading logs by theme, mood, or favorites.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-surface border border-border text-xs text-primary font-bold hover:text-primary-hover active:scale-[0.98] transition-all focus:outline-none"
            >
              Create first list
            </button>
          </div>
        )}
      </div>

      {/* New Shelf Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              className="relative w-full max-w-md bg-surface-raised border border-border rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-5 overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-border/40 pb-3">
                <h3 className="font-serif text-lg font-bold text-text-primary">Create Custom List</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Name Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider">LIST NAME</label>
                <input
                  type="text"
                  maxLength={40}
                  value={newShelfName}
                  onChange={(e) => setNewShelfName(e.target.value)}
                  placeholder="e.g. Cyberpunk Settings, Summer Reading..."
                  className="w-full bg-surface border border-border rounded-xl text-sm p-3.5 focus:outline-none focus:border-primary text-text-primary placeholder:text-text-secondary/35 font-sans"
                  autoFocus
                />
                <span className="text-[10px] text-text-secondary self-end">{newShelfName.length}/40</span>
              </div>

              {/* Curated Emoji Picker */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <label className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider">CHOOSE EMOJI</label>
                  <span className="text-xl select-none bg-surface p-1 rounded border border-border">{selectedEmoji}</span>
                </div>
                <div className="grid grid-cols-10 gap-1.5 max-h-36 overflow-y-auto pr-1 border border-border/40 p-2.5 rounded-xl bg-surface">
                  {CURATED_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`text-lg p-1.5 rounded transition-colors select-none flex items-center justify-center hover:bg-surface-raised ${
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
                      className="w-8 h-8 rounded-full border border-border/75 flex items-center justify-center relative hover:scale-105 active:scale-95 transition-transform focus:outline-none"
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      {selectedColor.name === color.name && (
                        <Check className="h-4 w-4 text-bg stroke-[3.5]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="flex gap-3 mt-2 shrink-0">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-surface border border-border font-sans font-bold text-sm text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateShelf}
                  disabled={!newShelfName.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary text-bg font-sans font-bold text-sm hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all focus:outline-none shadow"
                >
                  Create List
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
