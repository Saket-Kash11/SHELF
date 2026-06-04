export interface Book {
  workId: string;           // e.g. "/works/OL45883W"
  title: string;
  authors: string[];
  description: string;      // handle both string or {value: string}
  subjects: string[];       // raw Open Library subjects
  coverUrl: string | null;  // from Open Library Covers API
  firstPublishYear: number | null;
  pageCount: number | null;
  isbn: string | null;
  language: string | null;
  cachedAt?: number;
}

export interface SearchResult {
  books: Book[];
  totalResults: number;
  page: number;
}

export interface Author {
  authorId: string;
  name: string;
  bio: string | null;
  birthDate: string | null;
  personalName: string | null;
}
