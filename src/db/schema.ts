import Dexie, { type Table } from 'dexie';

export interface Book {
  workId: string; // e.g. "/works/OL45883W"
  title: string;
  authors: string[];
  description: string;
  subjects: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  pageCount: number | null;
  isbn: string | null;
  language: string | null;
  cachedAt?: number;
}

export interface Shelf {
  id?: number;
  name: string;
  emoji: string;
  isSystem: boolean;
  createdAt: number;
}

export interface ShelfBook {
  id?: number;
  shelfId: number;
  bookId: string;
  addedAt: number;
  rating?: number;
  startedAt?: number;
  finishedAt?: number;
  note?: string;
}

export interface BookTag {
  id?: number;
  bookId: string;
  tags: string[];
  updatedAt: number;
}

export interface ReadingSession {
  id?: number;
  bookId: string;
  date: string; // YYYY-MM-DD
  pagesRead: number;
}

export interface PdfFile {
  bookId: string;
  fileName: string;
  storedAt: number;
  totalPages: number;
  lastPage: number;
  bookmarks: Array<{ page: number; label: string; createdAt: number }>;
  blob?: Blob;
}

class ShelfDatabase extends Dexie {
  books!: Table<Book, string>;
  shelves!: Table<Shelf, number>;
  shelfBooks!: Table<ShelfBook, number>;
  bookTags!: Table<BookTag, number>;
  readingSessions!: Table<ReadingSession, number>;
  pdfFiles!: Table<PdfFile, string>;

  constructor() {
    super('ShelfDatabase');
    this.version(1).stores({
      books: '&workId, title, *authors, firstPublishYear, isbn',
      shelves: '++id, name, isSystem, createdAt',
      shelfBooks: '++id, [shelfId+bookId], shelfId, bookId, addedAt, rating, startedAt, finishedAt',
      bookTags: '++id, bookId, *tags, updatedAt',
      readingSessions: '++id, bookId, date, pagesRead',
      pdfFiles: '&bookId, fileName, storedAt, totalPages, lastPage, bookmarks',
    });
  }
}

export const db = new ShelfDatabase();

// Seed system shelves on first launch
db.on('populate', () => {
  db.shelves.bulkAdd([
    { name: 'Want to Read', emoji: '📚', isSystem: true, createdAt: Date.now() },
    { name: 'Reading', emoji: '📖', isSystem: true, createdAt: Date.now() },
    { name: 'Read', emoji: '✅', isSystem: true, createdAt: Date.now() }
  ]);
});
