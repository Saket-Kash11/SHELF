import { db } from '../db/schema';
import TaggerWorker from './tagger.worker?worker';

export interface BookTagRecord {
  id?: number;
  bookId: string;
  tags: string[];         // Merged final list of tags (indexed)
  mlTags: string[];       // Raw ML classifier tags
  manualAdded: string[];  // User-added tags
  manualRemoved: string[];// User-removed tags
  updatedAt: number;
}

export function runTaggingWorker(workId: string, description: string, subjects: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Instantiate Vite Web Worker
    const worker = new TaggerWorker();
    
    worker.postMessage({ workId, description, subjects });

    worker.onmessage = async (e: MessageEvent) => {
      const { workId: returnedWorkId, result, error } = e.data;
      worker.terminate();

      if (error) {
        console.error(`Tagging failed for ${returnedWorkId}:`, error);
        reject(new Error(error));
        return;
      }

      if (result) {
        try {
          // Flatten all categories of tags from Result to a single array
          const rawMlTags = [
            ...(result.mood || []),
            ...(result.pace || []),
            ...(result.setting || []),
            ...(result.theme || []),
            ...(result.genre || [])
          ];

          // Fetch existing record
          const existing = await db.bookTags.where('bookId').equals(workId).first() as unknown as BookTagRecord | undefined;

          const manualAdded = existing?.manualAdded || [];
          const manualRemoved = existing?.manualRemoved || [];

          // Compute merged list: (mlTags - manualRemoved) + manualAdded
          const merged = Array.from(new Set([
            ...rawMlTags.filter(t => !manualRemoved.includes(t)),
            ...manualAdded
          ]));

          const record: BookTagRecord = {
            id: existing?.id,
            bookId: workId,
            tags: merged,
            mlTags: rawMlTags,
            manualAdded,
            manualRemoved,
            updatedAt: Date.now()
          };

          // Save/Update in database
          await db.bookTags.put(record as any);
          console.log(`Successfully classified and stored tags for ${workId}`);
          resolve();
        } catch (dbErr) {
          console.error(`Failed to store tags in IndexedDB for ${workId}:`, dbErr);
          reject(dbErr);
        }
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      console.error(`Worker error:`, err);
      reject(err);
    };
  });
}
