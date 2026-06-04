import { db } from '../db/schema';
import type { Book, SearchResult, Author } from '../types/book';

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const authorCache: Record<string, string> = {};

function parseDescription(description: any): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  if (typeof description === 'object' && description.value) return description.value;
  return '';
}

export async function searchBooks(query: string, page = 1): Promise<SearchResult> {
  const cleanQuery = encodeURIComponent(query.trim());
  const url = `https://openlibrary.org/search.json?q=${cleanQuery}&page=${page}&limit=20`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  
  const data = await response.json();
  const docs = data.docs || [];
  
  const books: Book[] = docs.map((doc: any) => {
    const coverUrl = doc.cover_i 
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` 
      : null;
    
    return {
      workId: doc.key,
      title: doc.title,
      authors: doc.author_name || [],
      description: '', // Search endpoint doesn't return description
      subjects: doc.subject ? doc.subject.slice(0, 10) : [],
      coverUrl,
      firstPublishYear: doc.first_publish_year || null,
      pageCount: doc.number_of_pages_median || null,
      isbn: doc.isbn ? doc.isbn[0] : null,
      language: doc.language ? doc.language[0] : null,
      cachedAt: Date.now()
    };
  });

  // Save/Update the brief search results to the books cache without overwriting existing details
  for (const book of books) {
    const existing = await db.books.get(book.workId);
    if (!existing) {
      await db.books.put(book);
    }
  }

  return {
    books,
    totalResults: data.numFound || 0,
    page
  };
}

export async function getAuthor(authorId: string): Promise<Author> {
  const cleanId = authorId.replace('/authors/', '');
  const url = `https://openlibrary.org/authors/${cleanId}.json`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Author fetch failed for ${authorId}`);
  }
  
  const data = await response.json();
  const bio = parseDescription(data.bio);
  
  return {
    authorId,
    name: data.name || data.personal_name || 'Unknown Author',
    bio: bio || null,
    birthDate: data.birth_date || null,
    personalName: data.personal_name || null
  };
}

export async function getBook(workId: string): Promise<Book> {
  const cleanId = workId.replace('/works/', '');
  
  // 1. Check local cache first
  const cachedBook = await db.books.get(workId);
  const isCacheValid = cachedBook && cachedBook.cachedAt && (Date.now() - cachedBook.cachedAt < CACHE_TTL);
  
  // If we have a cached book with a description, it's a full cache hit
  if (isCacheValid && cachedBook.description) {
    return cachedBook;
  }
  
  // 2. Fetch full book details
  const url = `https://openlibrary.org/works/${cleanId}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Book fetch failed for ${workId}`);
  }
  
  const data = await response.json();
  
  // Try to use authors from cached book first (since search results have author names resolved)
  let authors: string[] = cachedBook?.authors || [];
  
  if (authors.length === 0 && data.authors && data.authors.length > 0) {
    const names: string[] = [];
    for (const authorRef of data.authors) {
      const authorKey = authorRef.author?.key;
      if (authorKey) {
        if (authorCache[authorKey]) {
          names.push(authorCache[authorKey]);
        } else {
          try {
            const auth = await getAuthor(authorKey);
            authorCache[authorKey] = auth.name;
            names.push(auth.name);
          } catch {
            names.push('Unknown Author');
          }
        }
      }
    }
    authors = names;
  }

  // Cover image extraction
  let coverUrl = cachedBook?.coverUrl || null;
  if (!coverUrl && data.covers && data.covers.length > 0) {
    coverUrl = `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`;
  }
  
  const bookDetail: Book = {
    workId,
    title: data.title || cachedBook?.title || 'Unknown Title',
    authors,
    description: parseDescription(data.description),
    subjects: data.subjects || cachedBook?.subjects || [],
    coverUrl,
    firstPublishYear: data.first_publish_year || cachedBook?.firstPublishYear || null,
    pageCount: data.number_of_pages_median || cachedBook?.pageCount || null,
    isbn: cachedBook?.isbn || null,
    language: cachedBook?.language || null,
    cachedAt: Date.now()
  };
  
  // Save/Update full book details in IndexedDB
  await db.books.put(bookDetail);
  
  return bookDetail;
}
