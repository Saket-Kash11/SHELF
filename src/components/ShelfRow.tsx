import { Link } from 'react-router-dom';
import BookCard from './BookCard';
import type { Book } from '../types/book';

interface ShelfRowProps {
  shelfId: number | string;
  name: string;
  emoji?: string;
  books: Book[];
  progressMap?: Record<string, number>; // workId -> progress %
}

export default function ShelfRow({ shelfId, name, emoji, books, progressMap = {} }: ShelfRowProps) {
  return (
    <div className="flex flex-col gap-3 py-4 border-b border-border/30 last:border-none">
      {/* Header section: Title and see all */}
      <div className="flex justify-between items-baseline px-1">
        <div className="flex items-center gap-2">
          {emoji && <span className="text-lg select-none">{emoji}</span>}
          <h2 className="font-serif text-lg font-bold text-text-primary tracking-wide">{name}</h2>
          <span className="font-mono text-[10px] text-text-secondary/60 bg-surface px-1.5 py-0.5 rounded-full border border-border">
            {books.length}
          </span>
        </div>
        
        <Link
          to={`/shelf/${shelfId}`}
          className="text-xs font-sans font-semibold text-primary hover:text-primary-hover hover:underline transition-all"
        >
          See all &rarr;
        </Link>
      </div>

      {/* Horizontal Scroll Strip */}
      {books.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 hide-scrollbar scroll-smooth snap-x">
          {books.map((book) => (
            <div key={book.workId} className="w-[110px] md:w-[130px] shrink-0 snap-start">
              <BookCard
                book={book}
                progress={progressMap[book.workId]}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-surface/30 border border-dashed border-border/50 text-center px-4">
          <span className="text-xs text-text-secondary">No books on this shelf yet.</span>
          <Link
            to="/search"
            className="text-[10px] font-sans font-bold text-primary uppercase tracking-wide hover:underline mt-2"
          >
            Find a book
          </Link>
        </div>
      )}
    </div>
  );
}
