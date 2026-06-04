import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Grid, List, Search as SearchIcon, SlidersHorizontal, ArrowUpDown, X, Star, FileText, AlertCircle } from 'lucide-react';
import { db } from '../db/schema';
import BookCard from '../components/BookCard';
import ContextMenu from '../components/ContextMenu';
import StarRating from '../components/StarRating';
import { TAXONOMY, type TagCategory } from '../ml/taxonomy';
import type { Book } from '../types/book';

type SortOption = 'dateAdded' | 'title' | 'author' | 'rating' | 'year';
type ViewMode = 'grid' | 'list';

export default function ShelfDetail() {
  const { shelfId } = useParams();
  const navigate = useNavigate();
  const shelfIdNum = parseInt(shelfId || '', 10);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('dateAdded');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Tag Filter Drawer States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempSelectedTags, setTempSelectedTags] = useState<string[]>([]);
  const [activeSelectedTags, setActiveSelectedTags] = useState<string[]>([]);

  // Mobile long-press states
  const touchTimer = useRef<any>(null);
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    book: Book | null;
    currentRating: number;
    currentNote: string;
    shelfBookId: number | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    book: null,
    currentRating: 0,
    currentNote: '',
    shelfBookId: null
  });

  // Query Database
  const shelf = useLiveQuery(() => db.shelves.get(shelfIdNum), [shelfIdNum]);
  const allShelves = useLiveQuery(() => db.shelves.toArray()) || [];
  const shelfBookRecords = useLiveQuery(() => db.shelfBooks.where('shelfId').equals(shelfIdNum).toArray(), [shelfIdNum]) || [];
  const books = useLiveQuery(() => db.books.toArray()) || [];
  const bookTags = useLiveQuery(() => db.bookTags.toArray()) || [];
  const pdfs = useLiveQuery(() => db.pdfFiles.toArray()) || [];

  if (!shelf) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-error mb-4 stroke-[1.5]" />
        <h3 className="font-serif text-xl font-semibold text-text-primary">Shelf not found</h3>
        <p className="text-text-secondary text-sm max-w-sm mt-2 mb-6">
          The requested shelf list does not exist in your library.
        </p>
        <button
          onClick={() => navigate('/shelf')}
          className="px-5 py-2 rounded-lg bg-surface border border-border text-primary hover:text-primary-hover font-sans text-sm font-semibold transition-colors"
        >
          Back to Shelves
        </button>
      </div>
    );
  }

  // Join Books data with Shelf records
  const booksOnShelf = shelfBookRecords.map(sb => {
    const book = books.find(b => b.workId === sb.bookId);
    return {
      book,
      shelfBook: sb
    };
  }).filter(item => item.book !== undefined) as Array<{ book: Book, shelfBook: any }>;

  // Extract all tags active on this shelf
  const availableTags = Array.from(new Set(
    booksOnShelf.flatMap(({ book }) => {
      const tagsRecord = bookTags.find(bt => bt.bookId === book.workId);
      return tagsRecord?.tags || [];
    })
  ));

  // Client-side instant filtering
  let filteredBooks = booksOnShelf.filter(({ book }) => {
    const q = searchQuery.toLowerCase();
    const titleMatch = book.title.toLowerCase().includes(q);
    const authorMatch = book.authors.some(a => a.toLowerCase().includes(q));
    
    const tagsRecord = bookTags.find(bt => bt.bookId === book.workId);
    const tags = tagsRecord?.tags || [];
    const tagMatch = tags.some(t => t.toLowerCase().includes(q));

    return titleMatch || authorMatch || tagMatch;
  });

  // Apply Tag Filters (AND search)
  if (activeSelectedTags.length > 0) {
    filteredBooks = filteredBooks.filter(({ book }) => {
      const tagsRecord = bookTags.find(bt => bt.bookId === book.workId);
      const tags = tagsRecord?.tags || [];
      return activeSelectedTags.every(t => tags.includes(t));
    });
  }

  // Apply Sorting
  filteredBooks.sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.book.title.localeCompare(b.book.title);
      case 'author':
        const authA = a.book.authors[0] || '';
        const authB = b.book.authors[0] || '';
        return authA.localeCompare(authB);
      case 'year':
        return (b.book.firstPublishYear || 0) - (a.book.firstPublishYear || 0);
      case 'rating':
        return (b.shelfBook.rating || 0) - (a.shelfBook.rating || 0);
      case 'dateAdded':
      default:
        return b.shelfBook.addedAt - a.shelfBook.addedAt;
    }
  });

  // Calculate live matching counts for the drawer
  const getLiveMatchCount = (testTags: string[]) => {
    let temp = booksOnShelf;
    const q = searchQuery.toLowerCase();
    if (q) {
      temp = temp.filter(({ book }) => {
        const titleMatch = book.title.toLowerCase().includes(q);
        const authorMatch = book.authors.some(a => a.toLowerCase().includes(q));
        return titleMatch || authorMatch;
      });
    }
    if (testTags.length > 0) {
      temp = temp.filter(({ book }) => {
        const tagsRecord = bookTags.find(bt => bt.bookId === book.workId);
        const tags = tagsRecord?.tags || [];
        return testTags.every(t => tags.includes(t));
      });
    }
    return temp.length;
  };

  // Toggle filter in drawer
  const handleTagToggle = (tag: string) => {
    setTempSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleApplyFilters = () => {
    setActiveSelectedTags(tempSelectedTags);
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    setTempSelectedTags([]);
    setActiveSelectedTags([]);
    setIsFilterOpen(false);
  };

  const handleRemoveActiveTag = (tag: string) => {
    const updated = activeSelectedTags.filter(t => t !== tag);
    setActiveSelectedTags(updated);
    setTempSelectedTags(updated);
  };

  // context menu handlers
  const handleDesktopRightClick = (e: React.MouseEvent, book: Book, shelfBook: any) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      book,
      currentRating: shelfBook.rating || 0,
      currentNote: shelfBook.note || '',
      shelfBookId: shelfBook.id
    });
  };

  const handleMobileTouchStart = (book: Book, shelfBook: any) => {
    setLongPressTriggered(false);
    touchTimer.current = setTimeout(() => {
      setLongPressTriggered(true);
      setContextMenu({
        isOpen: true,
        x: 0,
        y: 0,
        book,
        currentRating: shelfBook.rating || 0,
        currentNote: shelfBook.note || '',
        shelfBookId: shelfBook.id
      });
    }, 600);
  };

  const handleMobileTouchEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (longPressTriggered) {
      e.preventDefault();
      setLongPressTriggered(false);
    }
  };

  // DB Mutation Callbacks for ContextMenu
  const handleMoveShelf = async (targetShelfId: number) => {
    const item = contextMenu;
    if (!item.book || !item.shelfBookId) return;
    const workId = item.book.workId;

    const targetShelf = allShelves.find(s => s.id === targetShelfId);
    if (!targetShelf) return;

    // Transaction to safely delete and add relations (moves)
    await db.transaction('rw', [db.shelfBooks], async () => {
      // 1. Delete existing link
      await db.shelfBooks.delete(item.shelfBookId!);

      // 2. If system target shelf, remove from other system shelves
      if (targetShelf.isSystem) {
        const sysShelves = allShelves.filter(s => s.isSystem);
        for (const sysS of sysShelves) {
          const relation = await db.shelfBooks
            .where('shelfId').equals(sysS.id!)
            .filter(sb => sb.bookId === workId)
            .first();
          if (relation) {
            await db.shelfBooks.delete(relation.id!);
          }
        }
      }

      // 3. Add to target
      await db.shelfBooks.add({
        shelfId: targetShelfId,
        bookId: workId,
        addedAt: Date.now(),
        rating: item.currentRating || undefined,
        note: item.currentNote || undefined
      } as any);
    });
  };

  const handleRemoveFromShelf = async () => {
    if (contextMenu.shelfBookId) {
      await db.shelfBooks.delete(contextMenu.shelfBookId);
    }
  };

  const handleRateBook = async (rating: number) => {
    if (contextMenu.shelfBookId) {
      await db.shelfBooks.update(contextMenu.shelfBookId, { rating });
      // Update state dynamically
      setContextMenu(prev => ({ ...prev, currentRating: rating }));
    }
  };

  const handleSaveBookNote = async (note: string) => {
    if (contextMenu.shelfBookId) {
      await db.shelfBooks.update(contextMenu.shelfBookId, { note });
      // Update state dynamically
      setContextMenu(prev => ({ ...prev, currentNote: note }));
    }
  };

  // Construct PDF progress mapping
  const progressMap: Record<string, number> = {};
  pdfs.forEach(p => {
    if (p.totalPages > 0) {
      progressMap[p.bookId] = Math.round((p.lastPage / p.totalPages) * 100);
    }
  });

  return (
    <div className="w-full min-h-full px-6 py-8 md:px-10 md:py-12 max-w-7xl mx-auto flex flex-col pb-20 md:pb-12">
      {/* Header Row */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <button
          onClick={() => navigate('/shelf')}
          className="flex items-center justify-center h-9 w-9 rounded-full bg-surface border border-border text-text-primary hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl select-none">{shelf.emoji}</span>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-text-primary">
            {shelf.name}
          </h1>
          <span className="font-mono text-xs text-text-secondary/60 bg-surface border border-border px-2 py-0.5 rounded-full ml-1 select-none">
            {booksOnShelf.length}
          </span>
        </div>
      </div>

      {/* Dismissible active filters pills */}
      {activeSelectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6 shrink-0">
          {activeSelectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-xs font-sans text-primary font-medium select-none"
            >
              <span>{tag}</span>
              <button onClick={() => handleRemoveActiveTag(tag)} className="hover:text-red-400 p-0.5 rounded-full">
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={() => { setActiveSelectedTags([]); setTempSelectedTags([]); }}
            className="text-xs font-sans text-text-secondary hover:text-text-primary font-semibold self-center ml-2 transition-colors focus:outline-none"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Toolbar controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-border/30 pb-4 shrink-0">
        {/* Search Bar within shelf */}
        <div className="relative flex items-center bg-surface border border-border rounded-xl px-3.5 py-2.5 flex-1 max-w-md">
          <SearchIcon className="h-4 w-4 text-text-secondary mr-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, author, tag..."
            className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none font-sans"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[10px] text-text-secondary font-semibold font-sans px-1">Clear</button>
          )}
        </div>

        {/* View, Sort, and Filter operations */}
        <div className="flex items-center justify-between md:justify-end gap-3 select-none">
          {/* Sorting */}
          <div className="flex items-center gap-1.5 border border-border/80 rounded-xl px-3 py-2 bg-surface">
            <ArrowUpDown size={14} className="text-text-secondary" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-xs font-sans text-text-primary font-semibold focus:outline-none cursor-pointer"
            >
              <option value="dateAdded">Date Added</option>
              <option value="title">Title A–Z</option>
              <option value="author">Author</option>
              <option value="rating">Rating</option>
              <option value="year">Year</option>
            </select>
          </div>

          {/* Filter Trigger */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className={`flex items-center gap-1.5 border rounded-xl px-3 py-2 text-xs font-sans font-semibold transition-all focus:outline-none ${
              activeSelectedTags.length > 0
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-surface border-border/80 text-text-primary hover:bg-surface-raised'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Filter</span>
          </button>

          {/* Grid/List View Toggle */}
          <div className="flex items-center bg-surface border border-border rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all focus:outline-none ${
                viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all focus:outline-none ${
                viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Book List / Grid Display */}
      {filteredBooks.length > 0 ? (
        viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
            {filteredBooks.map(({ book, shelfBook }) => (
              <div
                key={book.workId}
                onContextMenu={(e) => handleDesktopRightClick(e, book, shelfBook)}
                onTouchStart={() => handleMobileTouchStart(book, shelfBook)}
                onTouchEnd={handleMobileTouchEnd}
                onClick={handleCardClick}
                className="relative"
              >
                <BookCard
                  book={book}
                  progress={progressMap[book.workId]}
                />
                
                {/* Visual indicators for Note / Ratings in grid corner */}
                <div className="absolute top-2 right-2 flex gap-1 pointer-events-none select-none z-10">
                  {shelfBook.rating && shelfBook.rating > 0 ? (
                    <div className="flex items-center gap-0.5 bg-bg/85 border border-border/40 px-1.5 py-0.5 rounded text-[10px] font-mono text-primary font-bold shadow backdrop-blur-sm">
                      <Star size={10} className="fill-primary text-primary" />
                      <span>{shelfBook.rating}</span>
                    </div>
                  ) : null}
                  {shelfBook.note ? (
                    <div className="bg-bg/85 border border-border/40 p-1 rounded shadow backdrop-blur-sm text-text-primary">
                      <FileText size={10} />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="flex flex-col border border-border/50 bg-surface/20 rounded-2xl divide-y divide-border/30 overflow-hidden shadow-sm">
            {filteredBooks.map(({ book, shelfBook }) => (
              <div
                key={book.workId}
                onContextMenu={(e) => handleDesktopRightClick(e, book, shelfBook)}
                onTouchStart={() => handleMobileTouchStart(book, shelfBook)}
                onTouchEnd={handleMobileTouchEnd}
                onClick={handleCardClick}
                className="flex items-center gap-4 p-4 hover:bg-surface-raised/20 transition-all select-none cursor-pointer"
              >
                {/* Mini cover */}
                <Link to={`/book${book.workId}`} className="shrink-0">
                  <div className="w-10 h-15 rounded border border-border/60 overflow-hidden bg-surface relative">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full text-[6px] text-center p-0.5 text-primary flex items-center justify-center font-bold font-serif leading-none">{book.title}</div>
                    )}
                  </div>
                </Link>

                {/* Metadata */}
                <div className="flex-1 min-w-0">
                  <Link to={`/book${book.workId}`} className="font-serif text-sm font-bold text-text-primary hover:text-primary truncate block">
                    {book.title}
                  </Link>
                  <span className="font-sans text-xs text-text-secondary truncate block mt-0.5">
                    {book.authors?.join(', ')}
                  </span>
                  {shelfBook.note && (
                    <p className="font-sans italic text-[11px] text-text-secondary/70 truncate mt-1 max-w-md">
                      "{shelfBook.note}"
                    </p>
                  )}
                </div>

                {/* Star rating display */}
                {shelfBook.rating && shelfBook.rating > 0 ? (
                  <div className="hidden sm:block shrink-0">
                    <StarRating rating={shelfBook.rating} readOnly size={14} />
                  </div>
                ) : null}

                {/* Year tag */}
                {book.firstPublishYear && (
                  <span className="hidden md:block font-mono text-[10px] text-text-secondary/40 select-none">
                    {book.firstPublishYear}
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* Empty Matches State */
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-text-secondary/40 mb-4 stroke-[1.5]" />
          <h3 className="font-serif text-lg font-semibold text-text-primary">No matching books</h3>
          <p className="text-text-secondary text-sm max-w-xs mt-1.5 leading-relaxed">
            No shelved titles matched your search query or tag criteria on this shelf.
          </p>
        </div>
      )}

      {/* Tag Filter Drawer Bottom Sheet */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop scrim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="absolute bottom-0 w-full max-w-md bg-surface-raised border-t border-border rounded-t-2xl p-6 shadow-2xl z-10 flex flex-col max-h-[80vh] overflow-hidden"
            >
              {/* Drag bar */}
              <div className="w-12 h-1 bg-border/80 rounded-full mx-auto mb-6 shrink-0" />

              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="font-serif text-lg font-bold text-text-primary">Filter by tag</h3>
                {tempSelectedTags.length > 0 && (
                  <button
                    onClick={() => setTempSelectedTags([])}
                    className="text-xs font-sans text-text-secondary hover:text-text-primary font-semibold transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Tag Checklist */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 pb-4">
                {availableTags.length > 0 ? (
                  // Group tags by category in checklist
                  (['mood', 'pace', 'setting', 'theme', 'genre'] as TagCategory[]).map(cat => {
                    const catTags = availableTags.filter(tag => {
                      return (TAXONOMY[cat] as readonly string[]).includes(tag);
                    });
                    if (catTags.length === 0) return null;

                    return (
                      <div key={cat} className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary/60 font-bold">{cat}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {catTags.map(tag => {
                            const isSelected = tempSelectedTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                onClick={() => handleTagToggle(tag)}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border font-sans font-medium transition-all ${
                                  isSelected
                                    ? 'bg-primary/20 border-primary text-primary'
                                    : 'bg-surface border-border text-text-primary hover:bg-surface-raised'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-text-secondary/70 text-center py-8">No tags available to filter.</span>
                )}
              </div>

              {/* CTAs */}
              <div className="flex gap-3 mt-4 border-t border-border/30 pt-4 shrink-0">
                <button
                  onClick={handleClearFilters}
                  className="flex-1 py-3 rounded-xl bg-surface border border-border font-sans font-bold text-sm text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
                >
                  Clear Filters
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 py-3 rounded-xl bg-primary text-bg font-sans font-bold text-sm hover:bg-primary-hover active:scale-[0.98] transition-all focus:outline-none shadow"
                >
                  Apply ({getLiveMatchCount(tempSelectedTags)})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating/Bottom Context Menu */}
      {contextMenu.book && (
        <ContextMenu
          isOpen={contextMenu.isOpen}
          onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false, book: null }))}
          x={contextMenu.x}
          y={contextMenu.y}
          book={contextMenu.book}
          allShelves={allShelves}
          currentShelfId={shelfIdNum}
          currentRating={contextMenu.currentRating}
          currentNote={contextMenu.currentNote}
          onMoveShelf={handleMoveShelf}
          onRemove={handleRemoveFromShelf}
          onRate={handleRateBook}
          onSaveNote={handleSaveBookNote}
        />
      )}
    </div>
  );
}
