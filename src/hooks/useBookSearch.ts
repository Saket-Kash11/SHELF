import { useState, useEffect } from 'react';
import { searchBooks } from '../api/openLibrary';
import type { Book } from '../types/book';

export function useBookSearch(query: string) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  // Reset state when query changes
  useEffect(() => {
    setBooks([]);
    setPage(1);
    setTotalResults(0);
    setError(null);
  }, [debouncedQuery]);

  // Fetch results
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setBooks([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    let active = true;

    async function doSearch() {
      setLoading(true);
      setError(null);
      try {
        const result = await searchBooks(trimmed, page);
        if (active) {
          setBooks((prev) => {
            if (page === 1) return result.books;
            // Prevent duplicates
            const ids = new Set(prev.map(b => b.workId));
            const filtered = result.books.filter(b => !ids.has(b.workId));
            return [...prev, ...filtered];
          });
          setTotalResults(result.totalResults);
          setHasMore(result.books.length > 0 && (books.length + result.books.length < result.totalResults));
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Could not connect to Open Library.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    doSearch();

    return () => {
      active = false;
    };
  }, [debouncedQuery, page]);

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  return { books, loading, error, hasMore, totalResults, loadMore };
}
