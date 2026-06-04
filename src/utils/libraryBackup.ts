import { db } from '../db/schema';

export interface BackupData {
  version: number;
  exportedAt: number;
  books: any[];
  shelves: any[];
  shelfBooks: any[];
  bookTags: any[];
  pdfFiles: any[];
}

export async function exportLibrary(): Promise<Blob> {
  const books = await db.books.toArray();
  const shelves = await db.shelves.toArray();
  const shelfBooks = await db.shelfBooks.toArray();
  const bookTags = await db.bookTags.toArray();
  const pdfFilesRaw = await db.pdfFiles.toArray();
  
  // Exclude large binary PDF blobs from JSON serialization
  const pdfFiles = pdfFilesRaw.map(({ blob, ...rest }) => rest);

  const backup: BackupData = {
    version: 1,
    exportedAt: Date.now(),
    books,
    shelves,
    shelfBooks,
    bookTags,
    pdfFiles
  };

  const jsonString = JSON.stringify(backup, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
}

export async function importLibrary(file: File, mode: 'merge' | 'replace'): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as BackupData;

  if (data.version !== 1 || !Array.isArray(data.books) || !Array.isArray(data.shelves)) {
    throw new Error('Invalid backup file format');
  }

  // Wrap inside a Dexie transaction for safety and atomicity
  await db.transaction('rw', [db.books, db.shelves, db.shelfBooks, db.bookTags, db.pdfFiles], async () => {
    if (mode === 'replace') {
      await db.books.clear();
      await db.shelves.clear();
      await db.shelfBooks.clear();
      await db.bookTags.clear();
      await db.pdfFiles.clear();
    }

    // 1. Restore books
    for (const book of data.books) {
      await db.books.put(book);
    }

    // 2. Restore shelves
    for (const shelf of data.shelves) {
      await db.shelves.put(shelf);
    }

    // 3. Restore shelfBooks
    for (const sb of data.shelfBooks) {
      await db.shelfBooks.put(sb);
    }

    // 4. Restore bookTags
    for (const bt of data.bookTags) {
      await db.bookTags.put(bt);
    }

    // 5. Restore pdfFiles metadata (protect existing binary blobs if merging)
    for (const pf of data.pdfFiles) {
      if (mode === 'merge') {
        const existing = await db.pdfFiles.get(pf.bookId);
        if (existing) {
          await db.pdfFiles.put({
            ...pf,
            blob: existing.blob
          });
          continue;
        }
      }
      await db.pdfFiles.put(pf);
    }
  });
}
