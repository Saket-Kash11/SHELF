import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Book } from '../types/book';

interface BookCardProps {
  book: Book;
  progress?: number; // 0 to 100 (percentage)
  shelfName?: string;
}

export function BookPlaceholder({ title }: { title: string }) {
  return (
    <div className="absolute inset-0 w-full h-full flex flex-col justify-between p-4 bg-gradient-to-br from-surface-raised to-surface border border-border rounded-lg shadow-inner overflow-hidden">
      {/* Golden accent bar */}
      <div className="flex justify-between items-center w-full">
        <div className="h-[1px] bg-primary/30 flex-1" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mx-2" />
        <div className="h-[1px] bg-primary/30 flex-1" />
      </div>
      
      {/* Title & spine look */}
      <div className="flex flex-col justify-center items-center text-center py-4">
        <span className="font-serif text-sm font-bold text-primary leading-snug line-clamp-4 px-1 select-none">
          {title}
        </span>
      </div>

      {/* Decorative details */}
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="w-8 h-[2px] bg-primary/20 rounded" />
        <div className="flex justify-between items-center w-full">
          <div className="h-[1px] bg-primary/30 flex-1" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mx-2" />
          <div className="h-[1px] bg-primary/30 flex-1" />
        </div>
      </div>
    </div>
  );
}

export default function BookCard({ book, progress, shelfName }: BookCardProps) {
  // Approximate perimeter of a rounded rectangle with width=96, height=146, rx=8:
  // P = 2 * (w + h) - 8 * r + 2 * pi * r ≈ 2*(96+146) - 64 + 50.2 = 470
  const perimeter = 470;
  const dashOffset = progress !== undefined ? perimeter - (progress / 100) * perimeter : perimeter;

  return (
    <Link to={`/book${book.workId}`}>
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
        className="flex flex-col cursor-pointer group"
      >
        {/* Cover Container (2:3 Aspect Ratio) */}
        <div className="relative w-full aspect-[2/3] rounded-lg bg-surface border border-border overflow-hidden shadow-md group-hover:shadow-xl group-hover:shadow-primary/5 transition-shadow">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <BookPlaceholder title={book.title} />
          )}

          {/* Genre Overlay Pill */}
          {book.subjects && book.subjects.length > 0 && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-bg/85 border border-border/40 text-[10px] font-sans font-medium text-text-primary tracking-wide backdrop-blur-sm pointer-events-none select-none max-w-[80%] truncate">
              {book.subjects[0]}
            </span>
          )}

          {/* Shelf Indicator Badge */}
          {shelfName && (
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-primary text-bg font-sans font-bold text-[9px] uppercase tracking-wider shadow pointer-events-none select-none">
              {shelfName}
            </span>
          )}

          {/* ProgressRing Trace SVG (rendered when progress exists) */}
          {progress !== undefined && progress > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              viewBox="0 0 100 150"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Background trace path */}
              <rect
                x="2"
                y="2"
                width="96"
                height="146"
                rx="6"
                stroke="rgba(200, 169, 126, 0.15)"
                strokeWidth="2.5"
              />
              {/* Highlight active progress path */}
              <motion.rect
                x="2"
                y="2"
                width="96"
                height="146"
                rx="6"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeDasharray={perimeter}
                initial={{ strokeDashoffset: perimeter }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </svg>
          )}
        </div>

        {/* Book Info Metadata */}
        <div className="mt-3 flex flex-col">
          <h3 className="font-serif text-[15px] font-bold text-text-primary group-hover:text-primary transition-colors line-clamp-1 leading-snug">
            {book.title}
          </h3>
          <p className="font-sans text-xs text-text-secondary line-clamp-1 mt-0.5">
            {book.authors && book.authors.length > 0 ? book.authors.join(', ') : 'Unknown Author'}
          </p>
          {book.firstPublishYear && (
            <span className="font-mono text-[10px] text-text-secondary/60 mt-1">
              {book.firstPublishYear}
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
