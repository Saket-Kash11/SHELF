import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, AlertCircle, Compass } from 'lucide-react';
import { useBookSearch } from '../hooks/useBookSearch';
import BookCard from '../components/BookCard';

function SkeletonCard() {
  return (
    <div className="flex flex-col">
      <div className="w-full aspect-[2/3] rounded-lg shimmer-skeleton border border-border/30" />
      <div className="h-4 w-3/4 rounded shimmer-skeleton mt-3" />
      <div className="h-3.5 w-1/2 rounded shimmer-skeleton mt-1.5" />
      <div className="h-3 w-1/4 rounded shimmer-skeleton mt-2" />
    </div>
  );
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { books, loading, error, hasMore, totalResults, loadMore } = useBookSearch(query);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  // Set up IntersectionObserver for infinite scrolling
  useEffect(() => {
    if (loading) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: '300px' }
    );

    if (triggerRef.current) {
      observerRef.current.observe(triggerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [books, loading, hasMore]);

  return (
    <div className="w-full min-h-full px-6 py-8 md:px-10 md:py-12 max-w-7xl mx-auto flex flex-col">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-text-primary tracking-tight">
          Explore Books
        </h1>
        <p className="text-text-secondary text-sm md:text-base mt-2 font-sans">
          Discover details, tags, and link companion reading logs from the Open Library.
        </p>
      </div>

      {/* Search Input Container */}
      <div className="mb-8">
        <motion.div
          animate={{
            scale: isFocused ? 1.01 : 1,
            borderColor: isFocused ? 'var(--primary)' : 'var(--border)',
            boxShadow: isFocused ? '0 4px 20px -2px rgba(200, 169, 126, 0.15)' : 'none',
          }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="relative flex items-center bg-surface border border-border rounded-xl px-4 py-3.5"
        >
          <SearchIcon className={`h-5 w-5 mr-3 transition-colors ${isFocused ? 'text-primary' : 'text-text-secondary'}`} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search by title, author, or keywords..."
            className="w-full bg-transparent text-text-primary placeholder:text-text-secondary/60 focus:outline-none font-sans text-base"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-text-secondary hover:text-text-primary font-sans font-medium px-2 py-1 rounded hover:bg-surface-raised transition-colors"
            >
              Clear
            </button>
          )}
        </motion.div>
      </div>

      {/* Search Results Area */}
      <div className="flex-1 flex flex-col justify-start">
        <AnimatePresence mode="wait">
          {/* 1. Empty State (no query) */}
          {!query && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center py-20 text-center"
            >
              <Compass className="h-12 w-12 text-primary/40 mb-4 stroke-[1.5]" />
              <h3 className="font-serif text-lg font-semibold text-text-primary">Start your discovery</h3>
              <p className="text-text-secondary text-sm max-w-xs mt-1.5 leading-relaxed">
                Start typing in the bar above to search through millions of titles.
              </p>
            </motion.div>
          )}

          {/* 2. Error State */}
          {error && !books.length && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center py-20 text-center"
            >
              <AlertCircle className="h-12 w-12 text-error mb-4 stroke-[1.5]" />
              <h3 className="font-serif text-lg font-semibold text-error">Search Failed</h3>
              <p className="text-text-secondary text-sm max-w-xs mt-1.5 mb-6 leading-relaxed">
                {error}
              </p>
              <button
                onClick={() => loadMore()}
                className="px-5 py-2 rounded-lg bg-surface-raised border border-border text-primary hover:text-primary-hover font-sans text-sm font-semibold transition-colors shadow-sm"
              >
                Retry Request
              </button>
            </motion.div>
          )}

          {/* 3. No Results State */}
          {query && !loading && !error && books.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center py-20 text-center"
            >
              <AlertCircle className="h-12 w-12 text-text-secondary/40 mb-4 stroke-[1.5]" />
              <h3 className="font-serif text-lg font-semibold text-text-primary">No results found</h3>
              <p className="text-text-secondary text-sm max-w-xs mt-1.5 leading-relaxed">
                We couldn't find any books for "{query}". Try checking your spelling or using different terms.
              </p>
            </motion.div>
          )}

          {/* 4. Book Grid */}
          {books.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              {totalResults > 0 && (
                <div className="text-xs text-text-secondary/60 font-mono mb-4">
                  FOUND {totalResults} MATCHES
                </div>
              )}
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
                {books.map((book) => (
                  <BookCard key={book.workId} book={book} />
                ))}

                {/* Shimmer skeletons while fetching subsequent pages */}
                {loading && (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                )}
              </div>

              {/* Trigger element for Infinite Scroll */}
              <div ref={triggerRef} className="h-10 mt-6 flex justify-center items-center">
                {hasMore && !loading && (
                  <span className="text-xs text-text-secondary/40 font-mono">LOADING SCROLL PENDING...</span>
                )}
              </div>
            </motion.div>
          )}

          {/* 5. Initial Search Shimmer (Query entered, first page load) */}
          {query && loading && books.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8"
            >
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
