import { BookTagger } from './bookTagger';

const tagger = new BookTagger();

self.onmessage = async (e: MessageEvent) => {
  const { workId, description, subjects } = e.data;
  try {
    const result = await tagger.tag(description, subjects);
    self.postMessage({ workId, result });
  } catch (err: any) {
    self.postMessage({
      workId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
