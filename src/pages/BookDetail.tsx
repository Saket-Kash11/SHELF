import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Plus, Check, ChevronDown, ChevronUp, AlertCircle, Sparkles, Tag, X, Search } from 'lucide-react';
import { db } from '../db/schema';
import { getBook } from '../api/openLibrary';
import type { Book } from '../types/book';
import { BookPlaceholder } from '../components/BookCard';
import { runTaggingWorker, type BookTagRecord } from '../ml/workerManager';
import { TAXONOMY, ALL_TAGS, type TagCategory } from '../ml/taxonomy';

export default function BookDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const workId = '/' + params['*'];
  
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Phase 2 UI States
  const [tagging, setTagging] = useState(false);
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  // Live query database for shelves and relationships
  const allShelves = useLiveQuery(() => db.shelves.toArray()) || [];
  const currentShelfBooks = useLiveQuery(() => db.shelfBooks.where('bookId').equals(workId).toArray()) || [];
  const currentShelfIds = currentShelfBooks.map((sb) => sb.shelfId);

  // Live query for book tags record
  const tagRecord = useLiveQuery(() => db.bookTags.where('bookId').equals(workId).first()) as unknown as BookTagRecord | undefined;

  // Live query for associated PDF file
  const pdfFile = useLiveQuery(() => db.pdfFiles.where('bookId').equals(workId).first());


  const readingShelfBook = currentShelfBooks.find((sb) => {
    const s = allShelves.find((shelf) => shelf.id === sb.shelfId);
    return s && (s.name === 'Reading' || s.name === 'Read');
  });
  
  const showDatePickers = !!readingShelfBook;
  const isFinishedVisible = readingShelfBook ? allShelves.find(s => s.id === readingShelfBook.shelfId)?.name === 'Read' : false;

  // Fetch book detail on mount / workId change
  useEffect(() => {
    let active = true;
    async function loadBook() {
      setLoading(true);
      setError(null);
      try {
        const data = await getBook(workId);
        if (active) {
          setBook(data);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Failed to load book details.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadBook();
    return () => {
      active = false;
    };
  }, [workId]);

  // Find active shelf names to show status indicator
  const activeShelves = allShelves.filter((s) => currentShelfIds.includes(s.id!));

  // Trigger auto-tagging if book is shelved but has no tag record
  useEffect(() => {
    if (book && activeShelves.length > 0 && !tagRecord && !tagging) {
      setTagging(true);
      runTaggingWorker(workId, book.description, book.subjects)
        .catch(console.error)
        .finally(() => setTagging(false));
    }
  }, [book, activeShelves.length, tagRecord, tagging, workId]);

  // Handle shelf selection toggle
  const handleShelfToggle = async (shelfId: number) => {
    const targetShelf = allShelves.find((s) => s.id === shelfId);
    if (!targetShelf) return;

    const existing = await db.shelfBooks
      .where('shelfId')
      .equals(shelfId)
      .filter((sb) => sb.bookId === workId)
      .first();

    if (existing) {
      // Toggle off
      await db.shelfBooks.delete(existing.id!);
    } else {
      // Toggle on
      if (targetShelf.isSystem) {
        // Mutually exclusive system shelves
        const systemShelves = allShelves.filter((s) => s.isSystem);
        for (const sysShelf of systemShelves) {
          const sysExist = await db.shelfBooks
            .where('shelfId')
            .equals(sysShelf.id!)
            .filter((sb) => sb.bookId === workId)
            .first();
          if (sysExist) {
            await db.shelfBooks.delete(sysExist.id!);
          }
        }
      }
      // Add relation
      await db.shelfBooks.add({
        shelfId,
        bookId: workId,
        addedAt: Date.now(),
      });

      // Trigger background classification on add to shelf
      if (book) {
        runTaggingWorker(workId, book.description, book.subjects).catch(console.error);
      }
    }
  };

  // Re-run ML tagging preserving overrides
  const handleReTag = async () => {
    if (!book) return;
    setTagging(true);
    try {
      await runTaggingWorker(workId, book.description, book.subjects);
    } catch (err) {
      console.error('Re-tagging failed:', err);
    } finally {
      setTagging(false);
    }
  };

  // Manually add tag to overrides
  const handleAddTag = async (tagName: string) => {
    const existing = tagRecord;
    const manualAdded = existing?.manualAdded || [];
    const manualRemoved = existing?.manualRemoved || [];
    const mlTags = existing?.mlTags || [];

    if (manualAdded.includes(tagName)) return;

    const newManualAdded = [...manualAdded, tagName];
    const newManualRemoved = manualRemoved.filter((t) => t !== tagName);

    const merged = Array.from(new Set([
      ...mlTags.filter((t) => !newManualRemoved.includes(t)),
      ...newManualAdded
    ]));

    await db.bookTags.put({
      id: existing?.id,
      bookId: workId,
      tags: merged,
      mlTags,
      manualAdded: newManualAdded,
      manualRemoved: newManualRemoved,
      updatedAt: Date.now()
    } as any);
  };

  // Manually remove tag
  const handleRemoveTag = async (tagName: string) => {
    const existing = tagRecord;
    if (!existing) return;

    const manualAdded = existing.manualAdded || [];
    const manualRemoved = existing.manualRemoved || [];
    const mlTags = existing.mlTags || [];

    const newManualAdded = manualAdded.filter((t) => t !== tagName);
    const newManualRemoved = [...manualRemoved, tagName];

    const merged = Array.from(new Set([
      ...mlTags.filter((t) => !newManualRemoved.includes(t)),
      ...newManualAdded
    ]));

    await db.bookTags.put({
      id: existing.id,
      bookId: workId,
      tags: merged,
      mlTags,
      manualAdded: newManualAdded,
      manualRemoved: newManualRemoved,
      updatedAt: Date.now()
    } as any);
  };

  const handleDateChange = async (field: 'startedAt' | 'finishedAt', value: string) => {
    const matchingShelfBook = currentShelfBooks.find(sb => {
      const shelf = allShelves.find(s => s.id === sb.shelfId);
      return shelf && (shelf.name === 'Reading' || shelf.name === 'Read');
    });
    if (!matchingShelfBook) return;

    const timestamp = value ? new Date(value).getTime() : undefined;
    await db.shelfBooks.update(matchingShelfBook.id!, { [field]: timestamp });
  };

  const formatDateForInput = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getReadingDuration = (sb: any) => {
    if (!sb.startedAt || !sb.finishedAt) return 0;
    const start = new Date(sb.startedAt).setHours(0,0,0,0);
    const finish = new Date(sb.finishedAt).setHours(0,0,0,0);
    const diffTime = finish - start;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([new Uint8Array(arrayBuffer)], { type: 'application/pdf' });

      await db.pdfFiles.put({
        bookId: workId,
        fileName: file.name,
        storedAt: Date.now(),
        totalPages: book?.pageCount || 0,
        lastPage: 1,
        bookmarks: [],
        blob
      });
      alert('PDF uploaded successfully!');
    } catch (err) {
      console.error('Failed to upload PDF:', err);
      alert('Error uploading PDF.');
    }
  };

  const handlePdfRemove = async () => {
    if (confirm('Are you sure you want to remove the associated PDF? This will delete the file content from your local browser storage.')) {
      await db.pdfFiles.delete(workId);
    }
  };


  // Group tags from tagRecord by categories for layout
  const getTagsByCategory = () => {
    if (!tagRecord) return null;
    const grouped: Record<TagCategory, string[]> = {
      mood: [],
      pace: [],
      setting: [],
      theme: [],
      genre: []
    };
    const categories = Object.keys(TAXONOMY) as TagCategory[];
    tagRecord.tags.forEach((tag) => {
      for (const cat of categories) {
        if ((TAXONOMY[cat] as readonly string[]).includes(tag)) {
          grouped[cat].push(tag);
          break;
        }
      }
    });
    return grouped;
  };

  const groupedTags = getTagsByCategory();

  if (loading) {
    return (
      <div className="w-full min-h-screen flex flex-col bg-bg">
        {/* Shimmer Hero */}
        <div className="h-[45vh] w-full shimmer-skeleton relative border-b border-border/20" />
        <div className="px-6 py-8 max-w-3xl mx-auto w-full flex-1">
          <div className="h-8 w-2/3 rounded shimmer-skeleton mb-4" />
          <div className="h-5 w-1/3 rounded shimmer-skeleton mb-8" />
          <div className="h-4 w-full rounded shimmer-skeleton mb-3" />
          <div className="h-4 w-full rounded shimmer-skeleton mb-3" />
          <div className="h-4 w-4/5 rounded shimmer-skeleton mb-8" />
          <div className="h-10 w-full rounded-xl shimmer-skeleton" />
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-error mb-4 stroke-[1.5]" />
        <h3 className="font-serif text-xl font-semibold text-text-primary">Could not load book</h3>
        <p className="text-text-secondary text-sm max-w-sm mt-2 mb-6">
          {error || 'The requested book details are unavailable.'}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary font-sans text-sm font-semibold transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-lg bg-surface-raised border border-border text-primary hover:text-primary-hover font-sans text-sm font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-bg flex flex-col relative pb-24">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-30 flex items-center justify-center h-10 w-10 rounded-full bg-bg/75 border border-border/30 text-text-primary hover:text-primary transition-colors backdrop-blur-sm shadow"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Hero Header Banner */}
      <div className="relative h-[45vh] md:h-[50vh] w-full overflow-hidden shrink-0">
        {/* Blurry Cover Backdrop */}
        {book.coverUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 opacity-30 select-none pointer-events-none"
            style={{ backgroundImage: `url(${book.coverUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-surface-raised to-bg opacity-40" />
        )}

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent z-10" />

        {/* Foreground Card */}
        <div className="absolute inset-0 flex flex-col justify-end items-center p-6 z-20">
          <div className="w-36 md:w-44 aspect-[2/3] rounded-lg shadow-2xl border border-border/30 overflow-hidden bg-surface relative mb-6">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <BookPlaceholder title={book.title} />
            )}
          </div>
        </div>
      </div>

      {/* Book Metadata & Description Panel */}
      <div className="px-6 max-w-3xl mx-auto w-full flex-1 flex flex-col">
        {/* Active Shelves Status */}
        {activeShelves.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {activeShelves.map((shelf) => (
              <span
                key={shelf.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-raised border border-primary/20 text-xs font-sans text-primary font-semibold select-none"
              >
                <span>{shelf.emoji}</span>
                <span>{shelf.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Title and Authors */}
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-text-primary tracking-tight leading-tight px-4">
            {book.title}
          </h1>
          <p className="text-text-secondary text-sm md:text-base font-sans mt-2">
            by {book.authors && book.authors.length > 0 ? book.authors.join(', ') : 'Unknown Author'}
          </p>
        </div>

        {/* Metadata Details Row */}
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 py-3 border-y border-border/50 text-[11px] md:text-xs font-mono text-text-secondary/70 mb-6 bg-surface/20 rounded px-2">
          {book.firstPublishYear && <span>PUB {book.firstPublishYear}</span>}
          {book.firstPublishYear && <span className="text-border">•</span>}
          {book.pageCount && <span>{book.pageCount} PAGES</span>}
          {book.pageCount && <span className="text-border">•</span>}
          {book.language && <span className="uppercase">{book.language}</span>}
          {book.language && <span className="text-border">•</span>}
          {book.isbn ? (
            <span className="truncate max-w-[150px]">ISBN {book.isbn}</span>
          ) : (
            <span>NO ISBN</span>
          )}
        </div>

        {/* Expandable Description */}
        <div className="mb-8">
          <h2 className="font-serif text-lg font-bold text-text-primary mb-3">Synopsis</h2>
          <div className="relative">
            <p
              className={`font-sans text-sm md:text-base text-text-secondary/90 leading-relaxed transition-all duration-300 ${
                !isDescExpanded ? 'line-clamp-4' : ''
              }`}
            >
              {book.description || 'No description available.'}
            </p>
            {book.description && book.description.length > 180 && (
              <button
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className="mt-2 flex items-center gap-1 text-xs font-sans text-primary hover:text-primary-hover font-semibold transition-colors focus:outline-none"
              >
                {isDescExpanded ? (
                  <>
                    <span>Read less</span>
                    <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    <span>Read more</span>
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Reading Dates Log (Displayed when on Reading or Read shelf) */}
        {showDatePickers && readingShelfBook && (
          <div className="mb-8 p-5 bg-surface border border-border rounded-2xl flex flex-col gap-4 shrink-0">
            <h2 className="font-serif text-lg font-bold text-text-primary flex items-center gap-2">
              <span className="text-xl select-none">📅</span>
              <span>Reading Dates</span>
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Started Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider">DATE STARTED</label>
                <input
                  type="date"
                  value={formatDateForInput(readingShelfBook.startedAt)}
                  onChange={(e) => handleDateChange('startedAt', e.target.value)}
                  className="bg-surface-raised border border-border rounded-xl text-xs p-3 text-text-primary focus:outline-none focus:border-primary font-sans cursor-pointer"
                />
              </div>

              {/* Finished Date (Only visible if on Read shelf) */}
              {isFinishedVisible && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider">DATE FINISHED</label>
                  <input
                    type="date"
                    value={formatDateForInput(readingShelfBook.finishedAt)}
                    onChange={(e) => handleDateChange('finishedAt', e.target.value)}
                    className="bg-surface-raised border border-border rounded-xl text-xs p-3 text-text-primary focus:outline-none focus:border-primary font-sans cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Finished in X days calculation */}
            {isFinishedVisible && readingShelfBook.startedAt && readingShelfBook.finishedAt && (
              <div className="mt-2 self-start px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-sans text-primary font-semibold">
                Finished in {getReadingDuration(readingShelfBook)} day{getReadingDuration(readingShelfBook) === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}

        {/* PDF File Management Panel */}
        {activeShelves.length > 0 && (
          <div className="mb-8 p-5 bg-surface border border-border rounded-2xl flex flex-col gap-4 shrink-0">
            <h2 className="font-serif text-lg font-bold text-text-primary flex items-center gap-2">
              <span className="text-xl select-none">📄</span>
              <span>PDF Companion</span>
            </h2>
            
            {pdfFile ? (
              <div className="flex flex-col gap-3 font-sans text-sm text-text-secondary">
                <div className="flex justify-between items-center bg-surface-raised/40 border border-border/30 px-3 py-2.5 rounded-lg">
                  <div className="flex flex-col gap-0.5 truncate max-w-[70%]">
                    <span className="text-xs font-bold text-text-primary truncate">{pdfFile.fileName}</span>
                    <span className="text-[10px] font-mono text-text-secondary/60">
                      {pdfFile.totalPages > 0 ? `${pdfFile.totalPages} pages` : 'Reading progress'} • {Math.round((pdfFile.lastPage / (pdfFile.totalPages || 1)) * 100)}% read
                    </span>
                  </div>
                  <button
                    onClick={handlePdfRemove}
                    className="text-xs text-error hover:text-error/85 transition-colors font-semibold"
                  >
                    Delete File
                  </button>
                </div>
                
                <div className="flex gap-3 mt-1">
                  <button
                    onClick={() => navigate(`/reader?bookId=${encodeURIComponent(workId)}`)}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-bg font-sans font-bold text-xs hover:bg-primary-hover transition-colors shadow text-center"
                  >
                    Open Reader (Page {pdfFile.lastPage})
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 border border-dashed border-border/60 rounded-xl bg-surface-raised/10">
                <span className="text-xs text-text-secondary">No PDF uploaded for this book yet.</span>
                <label className="px-4 py-2 rounded-xl bg-surface border border-border text-xs text-primary font-bold hover:text-primary-hover active:scale-[0.98] transition-all cursor-pointer select-none">
                  Upload PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        )}


        {/* Smart Tags Section (Displayed for Shelved Books) */}
        {activeShelves.length > 0 && (
          <div className="mb-8 shrink-0">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary stroke-[1.5]" />
                <h2 className="font-serif text-lg font-bold text-text-primary">Smart Tags</h2>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTagSearch(!showTagSearch)}
                  className="flex items-center gap-1 text-xs font-sans text-primary hover:text-primary-hover font-semibold transition-colors focus:outline-none"
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span>Add Tag</span>
                </button>
                <button
                  onClick={handleReTag}
                  disabled={tagging}
                  className="text-xs font-sans text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 focus:outline-none font-medium"
                >
                  {tagging ? 'Tagging...' : 'Re-tag'}
                </button>
              </div>
            </div>

            {/* Searchable Add Tag Dropdown */}
            {showTagSearch && (
              <div className="mb-4 p-4 rounded-xl bg-surface border border-border flex flex-col gap-3">
                <div className="relative flex items-center bg-surface-raised border border-border/80 rounded-lg px-3 py-2">
                  <Search className="h-4 w-4 text-text-secondary mr-2" />
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    placeholder="Search all 68 taxonomy tags..."
                    className="w-full bg-transparent text-xs text-text-primary focus:outline-none placeholder:text-text-secondary/50 font-sans"
                  />
                  {tagSearchQuery && (
                    <button
                      onClick={() => setTagSearchQuery('')}
                      className="text-[10px] text-text-secondary font-sans font-medium px-1.5 py-0.5 rounded hover:bg-surface transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                {/* Scrollable grid matches */}
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {ALL_TAGS.filter((tag) => 
                    tag.toLowerCase().includes(tagSearchQuery.toLowerCase()) && 
                    !(tagRecord?.tags || []).includes(tag)
                  ).slice(0, 15).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        handleAddTag(tag);
                        setTagSearchQuery('');
                        setShowTagSearch(false);
                      }}
                      className="px-2.5 py-1 rounded bg-surface-raised border border-border text-[11px] font-sans text-text-primary hover:border-primary hover:text-primary transition-all font-semibold"
                    >
                      {tag}
                    </button>
                  ))}
                  {ALL_TAGS.filter((tag) => 
                    tag.toLowerCase().includes(tagSearchQuery.toLowerCase()) && 
                    !(tagRecord?.tags || []).includes(tag)
                  ).length === 0 && (
                    <span className="text-xs text-text-secondary/60 font-sans py-2">No matching tags found.</span>
                  )}
                </div>
              </div>
            )}

            {/* Display Categorized Tags */}
            {groupedTags && Object.values(groupedTags).some((arr) => arr.length > 0) ? (
              <div className="flex flex-col gap-4">
                {(Object.keys(TAXONOMY) as TagCategory[]).map((cat) => {
                  const tags = groupedTags[cat];
                  if (!tags || tags.length === 0) return null;
                  
                  let styleClass = '';
                  switch (cat) {
                    case 'mood': styleClass = 'bg-tag-mood/10 text-tag-mood border-tag-mood/30 hover:bg-tag-mood/20'; break;
                    case 'pace': styleClass = 'bg-tag-pace/10 text-tag-pace border-tag-pace/30 hover:bg-tag-pace/20'; break;
                    case 'setting': styleClass = 'bg-tag-setting/10 text-tag-setting border-tag-setting/30 hover:bg-tag-setting/20'; break;
                    case 'theme': styleClass = 'bg-tag-theme/10 text-tag-theme border-tag-theme/30 hover:bg-tag-theme/20'; break;
                    case 'genre': styleClass = 'bg-tag-genre/10 text-tag-genre border-tag-genre/30 hover:bg-tag-genre/20'; break;
                  }

                  return (
                    <div key={cat} className="flex flex-col gap-1.5">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary/60 font-bold">{cat}</span>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-sans font-medium transition-colors select-none ${styleClass}`}
                          >
                            <span>{tag}</span>
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="hover:text-error p-0.5 rounded-full hover:bg-black/10 transition-colors"
                              title={`Remove ${tag}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-surface border border-border text-center flex flex-col items-center">
                <span className="text-xs text-text-secondary">{tagging ? 'Analyzing book summaries...' : 'No tags generated yet.'}</span>
                <button
                  onClick={handleReTag}
                  disabled={tagging}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-surface-raised border border-border text-xs text-primary font-semibold hover:text-primary-hover transition-colors focus:outline-none"
                >
                  {tagging ? 'Analyzing...' : 'Generate Smart Tags'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unshelved fallback raw subjects listing */}
        {activeShelves.length === 0 && book.subjects && book.subjects.length > 0 && (
          <div className="mb-8 shrink-0">
            <h2 className="font-serif text-lg font-bold text-text-primary mb-3">Subjects</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
              {book.subjects.map((sub, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-surface border border-border text-[11px] font-sans text-text-secondary whitespace-nowrap select-none"
                >
                  {sub}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-surface/90 backdrop-blur-md border-t border-border/80 flex items-center justify-center px-6 z-40">
        <div className="w-full max-w-3xl flex items-center justify-between gap-4">
          <button
            onClick={() => setIsSheetOpen(true)}
            className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-bg font-sans font-bold text-sm hover:bg-primary-hover active:scale-[0.98] transition-all shadow"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{currentShelfIds.length > 0 ? 'Move / Update Shelf' : 'Add to Shelf'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Sheet Shelf Selector */}
      <AnimatePresence>
        {isSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop Scrim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSheetOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="absolute bottom-0 w-full max-w-md bg-surface-raised border-t border-border rounded-t-2xl p-6 shadow-2xl flex flex-col z-10 max-h-[80vh] overflow-hidden"
            >
              {/* Drag line */}
              <div className="w-12 h-1 bg-border/80 rounded-full mx-auto mb-6 shrink-0" />

              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="font-serif text-lg font-bold text-text-primary">Select Shelf</h3>
                <button
                  onClick={() => setIsSheetOpen(false)}
                  className="text-xs font-sans text-text-secondary hover:text-text-primary font-semibold transition-colors"
                >
                  Done
                </button>
              </div>

              {/* Shelf Options List */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 pb-4">
                {allShelves.map((shelf) => {
                  const isSelected = currentShelfIds.includes(shelf.id!);
                  return (
                    <button
                      key={shelf.id}
                      onClick={() => handleShelfToggle(shelf.id!)}
                      className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-surface border-border text-text-primary hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="text-xl select-none">{shelf.emoji}</span>
                        <span className="font-sans text-sm font-semibold tracking-wide">
                          {shelf.name}
                        </span>
                      </div>
                      {isSelected ? (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-bg shadow">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border border-border/80" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
