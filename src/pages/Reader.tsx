import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, 
  Menu, Bookmark, List, Plus, Trash2, ArrowLeft, BookOpen, AlertCircle 
} from 'lucide-react';
import { db } from '../db/schema';

interface OutlineItem {
  title: string;
  pageNumber: number | null;
}

export default function Reader() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookId = searchParams.get('bookId');

  // Active book database queries
  const pdfRecord = useLiveQuery(
    () => (bookId ? db.pdfFiles.where('bookId').equals(bookId).first() : Promise.resolve(undefined)),
    [bookId]
  );
  const bookRecord = useLiveQuery(
    () => (bookId ? db.books.where('workId').equals(bookId).first() : Promise.resolve(undefined)),
    [bookId]
  );

  // Fallback View query: list all books with uploaded PDFs
  const pdfBooksList = useLiveQuery(async () => {
    if (bookId) return [];
    const pdfs = await db.pdfFiles.toArray();
    const allBooks = await db.books.toArray();
    
    return pdfs.map(p => {
      const b = allBooks.find(book => book.workId === p.bookId);
      return {
        pdf: p,
        book: b
      };
    });
  }, [bookId]);

  // Reader core states
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'none'>('width');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'bookmarks' | 'outline'>('bookmarks');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [newBookmarkLabel, setNewBookmarkLabel] = useState<string>('');

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Reading session page tracking to count unique pages read this session
  const [pagesReadInSession, setPagesReadInSession] = useState<Set<number>>(new Set());
  const lastSessionSizeRef = useRef<number>(0);

  // Reset reader state when book changes
  useEffect(() => {
    setPdfDocument(null);
    setCurrentPage(1);
    setZoom(1.0);
    setFitMode('width');
    setOutline([]);
    setLoading(true);
    setError(null);
    setPagesReadInSession(new Set());
    lastSessionSizeRef.current = 0;
  }, [bookId]);

  // 1. PDF Parser Engine Load
  useEffect(() => {
    if (!bookId || !pdfRecord) return;
    
    let active = true;
    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          throw new Error('PDF.js library failed to load from CDN. Please check your internet connection.');
        }

        // Configure Worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        if (!pdfRecord.blob) {
          throw new Error('PDF file blob is missing in database.');
        }

        // Read blob array buffer
        const arrayBuffer = await pdfRecord.blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        
        const pdf = await loadingTask.promise;
        
        if (!active) return;
        
        setPdfDocument(pdf);
        
        // Restore last read page
        const startPage = pdfRecord.lastPage || 1;
        setCurrentPage(Math.min(startPage, pdf.numPages));
        
        // Sync metadata (total pages) back to Dexie if missing or outdated
        if (pdfRecord.totalPages !== pdf.numPages) {
          await db.pdfFiles.update(bookId, { totalPages: pdf.numPages });
          if (bookRecord && (!bookRecord.pageCount || bookRecord.pageCount === 0)) {
            await db.books.update(bookId, { pageCount: pdf.numPages });
          }
        }

        // Fetch built-in document outline (bookmarks table of contents)
        try {
          const rawOutline = await pdf.getOutline();
          const parsed: OutlineItem[] = [];
          if (rawOutline) {
            for (const item of rawOutline) {
              let pageNumber: number | null = null;
              if (typeof item.dest === 'string') {
                const destObj = await pdf.getDestination(item.dest);
                if (destObj && destObj.length > 0) {
                  const ref = destObj[0];
                  pageNumber = (await pdf.getPageIndex(ref)) + 1;
                }
              } else if (Array.isArray(item.dest) && item.dest.length > 0) {
                const ref = item.dest[0];
                pageNumber = (await pdf.getPageIndex(ref)) + 1;
              }
              parsed.push({
                title: item.title,
                pageNumber
              });
            }
          }
          setOutline(parsed);
        } catch (tocErr) {
          console.warn('Could not parse PDF outline:', tocErr);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('PDF parsing failure:', err);
        if (active) {
          setError(err.message || 'Error loading PDF file.');
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => {
      active = false;
    };
  }, [bookId, pdfRecord, bookRecord]);

  // 2. Main Page Render Loop
  useEffect(() => {
    if (!pdfDocument || loading) return;

    let active = true;
    const canvas = canvasRef.current;

    async function renderPage() {
      try {
        if (!canvas || !active) return;
        const page = await pdfDocument.getPage(currentPage);
        if (!active) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        let viewport = page.getViewport({ scale: zoom });

        // Calculate auto fits
        if (fitMode === 'width') {
          const containerWidth = canvas.parentElement?.clientWidth || 800;
          // Apply horizontal padding factor (e.g. 96%) to canvas
          const targetWidth = containerWidth * 0.95;
          const scale = targetWidth / viewport.width;
          viewport = page.getViewport({ scale: scale * zoom });
        } else if (fitMode === 'page') {
          const containerHeight = canvas.parentElement?.clientHeight || 600;
          const targetHeight = containerHeight * 0.92;
          const scale = targetHeight / viewport.height;
          viewport = page.getViewport({ scale: scale * zoom });
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error('PDF render loop error:', err);
      }
    }

    renderPage();
    return () => {
      active = false;
    };
  }, [pdfDocument, currentPage, zoom, fitMode, loading]);

  // 3. Page Progress & Memory Tracking
  useEffect(() => {
    if (!bookId || !pdfDocument || loading) return;

    // Track last read page memory inside pdfFiles table
    db.pdfFiles.update(bookId, { lastPage: currentPage });

    // Track unique pages read in session state
    setPagesReadInSession(prev => {
      const next = new Set(prev);
      next.add(currentPage);
      return next;
    });
  }, [currentPage, bookId, pdfDocument, loading]);

  // 4. Session Delta Streak Logger
  useEffect(() => {
    if (!bookId || pagesReadInSession.size === 0) return;
    
    const delta = pagesReadInSession.size - lastSessionSizeRef.current;
    if (delta <= 0) return;

    const todayStr = new Date().toLocaleDateString('sv').split(' ')[0]; // YYYY-MM-DD

    async function logSessionProgress() {
      const existing = await db.readingSessions
        .where({ bookId, date: todayStr })
        .first();

      if (existing) {
        await db.readingSessions.update(existing.id!, {
          pagesRead: existing.pagesRead + delta
        });
      } else {
        await db.readingSessions.add({
          bookId,
          date: todayStr,
          pagesRead: delta
        });
      }
      lastSessionSizeRef.current = pagesReadInSession.size;
    }

    logSessionProgress();
  }, [pagesReadInSession.size, bookId]);

  // Handlers
  const handleNextPage = () => {
    if (!pdfDocument) return;
    setCurrentPage(prev => Math.min(prev + 1, pdfDocument.numPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleJumpPage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pdfDocument) return;
    const form = e.currentTarget;
    const input = form.elements.namedItem('pageInput') as HTMLInputElement;
    const pageNum = parseInt(input.value, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pdfDocument.numPages) {
      setCurrentPage(pageNum);
    }
    input.value = '';
  };

  // Bookmark actions
  const handleAddBookmark = async () => {
    if (!bookId || !pdfRecord || !newBookmarkLabel.trim()) return;
    
    const newBookmark = {
      page: currentPage,
      label: newBookmarkLabel.trim(),
      createdAt: Date.now()
    };

    const updated = [...(pdfRecord.bookmarks || []), newBookmark].sort((a, b) => a.page - b.page);
    await db.pdfFiles.update(bookId, { bookmarks: updated });
    setNewBookmarkLabel('');
  };

  const handleDeleteBookmark = async (createdAt: number) => {
    if (!bookId || !pdfRecord) return;
    const updated = (pdfRecord.bookmarks || []).filter(b => b.createdAt !== createdAt);
    await db.pdfFiles.update(bookId, { bookmarks: updated });
  };

  // Toggle fits
  const toggleFitMode = () => {
    setFitMode(prev => {
      if (prev === 'width') return 'page';
      if (prev === 'page') return 'none';
      return 'width';
    });
  };

  // Loading spinner elements
  if (bookId && loading && !error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-bg gap-3">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="font-sans text-xs text-text-secondary">Rendering digital pages...</span>
      </div>
    );
  }

  // Error layout details
  if (bookId && error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-bg gap-4">
        <AlertCircle className="h-12 w-12 text-error stroke-[1.5]" />
        <h2 className="font-serif text-lg font-bold text-text-primary">Failed to Open PDF</h2>
        <p className="text-text-secondary text-xs max-w-sm leading-relaxed">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 px-5 py-2 rounded-xl bg-surface border border-border text-xs text-primary font-bold hover:text-primary-hover active:scale-[0.98] transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Active E-Reader Mode UI
  if (bookId && pdfDocument) {
    return (
      <div className="w-full h-screen flex flex-col overflow-hidden bg-[#120F0D] select-none text-text-primary">
        {/* Header Bar */}
        <header className="h-14 bg-surface border-b border-border/80 flex items-center justify-between px-4 z-30 shrink-0 select-none">
          <div className="flex items-center gap-3 max-w-[40%]">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-colors"
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="font-serif text-sm font-bold truncate text-text-primary leading-none" title={bookRecord?.title}>
              {bookRecord?.title || 'E-Reader'}
            </h1>
          </div>

          {/* Page controls */}
          <div className="flex items-center gap-1 font-mono text-xs">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1.5 rounded hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none text-text-secondary hover:text-text-primary"
            >
              <ChevronLeft size={16} />
            </button>
            
            <form onSubmit={handleJumpPage} className="flex items-center">
              <input
                type="text"
                name="pageInput"
                placeholder={currentPage.toString()}
                className="w-10 bg-bg/80 border border-border/40 rounded text-center text-xs py-0.5 focus:outline-none focus:border-primary text-text-primary placeholder:text-text-primary"
              />
              <span className="text-text-secondary/50 mx-1.5">/</span>
              <span className="text-text-secondary">{pdfDocument.numPages}</span>
            </form>

            <button
              onClick={handleNextPage}
              disabled={currentPage >= pdfDocument.numPages}
              className="p-1.5 rounded hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none text-text-secondary hover:text-text-primary"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* View adjustment tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
              className="p-2 rounded hover:bg-surface-raised text-text-secondary hover:text-text-primary"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="font-mono text-[10px] text-text-secondary w-10 text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(z + 0.1, 3.0))}
              className="p-2 rounded hover:bg-surface-raised text-text-secondary hover:text-text-primary"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>

            <button
              onClick={toggleFitMode}
              className={`p-2 rounded hover:bg-surface-raised text-text-secondary hover:text-text-primary ${
                fitMode !== 'none' ? 'text-primary bg-primary/10' : ''
              }`}
              title={`Fit Options: Active (${fitMode})`}
            >
              {fitMode === 'page' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <div className="h-4 w-[1px] bg-border/45 mx-1" />

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded hover:bg-surface-raised text-text-secondary hover:text-text-primary ${
                sidebarOpen ? 'text-primary bg-primary/10' : ''
              }`}
              title="Toggle Sidebar"
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        {/* Reader Workspace */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Side navigation drawer (Bookmarks & TOC) */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="h-full bg-surface border-r border-border/80 flex flex-col shrink-0 z-20 overflow-hidden font-sans"
              >
                {/* Tab switchers */}
                <div className="flex border-b border-border/40 p-2 gap-1.5 shrink-0 text-xs font-semibold">
                  <button
                    onClick={() => setSidebarTab('bookmarks')}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors focus:outline-none ${
                      sidebarTab === 'bookmarks' ? 'bg-primary text-bg' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised/40'
                    }`}
                  >
                    <Bookmark size={12} />
                    <span>Bookmarks</span>
                  </button>
                  <button
                    onClick={() => setSidebarTab('outline')}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors focus:outline-none ${
                      sidebarTab === 'outline' ? 'bg-primary text-bg' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised/40'
                    }`}
                  >
                    <List size={12} />
                    <span>Outline</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {/* Bookmarks panels */}
                  {sidebarTab === 'bookmarks' && (
                    <div className="flex flex-col gap-4">
                      {/* Add Bookmark form */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={30}
                          value={newBookmarkLabel}
                          onChange={(e) => setNewBookmarkLabel(e.target.value)}
                          placeholder="Bookmark title..."
                          className="flex-1 bg-surface-raised border border-border/80 rounded-lg text-xs px-2.5 py-2 text-text-primary placeholder:text-text-secondary/35 focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={handleAddBookmark}
                          disabled={!newBookmarkLabel.trim()}
                          className="px-2.5 py-2 rounded-lg bg-primary text-bg hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:pointer-events-none"
                          title="Add Bookmark"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Bookmarks List */}
                      <div className="flex flex-col gap-2 mt-2">
                        {pdfRecord?.bookmarks && pdfRecord.bookmarks.length > 0 ? (
                          pdfRecord.bookmarks.map((bm) => (
                            <div 
                              key={bm.createdAt}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-raised/35 border border-border/40 hover:border-primary/20 transition-all group"
                            >
                              <button
                                onClick={() => setCurrentPage(bm.page)}
                                className="flex-1 text-left flex flex-col gap-0.5"
                              >
                                <span className="text-xs font-bold text-text-primary leading-tight group-hover:text-primary transition-colors">
                                  {bm.label}
                                </span>
                                <span className="text-[9px] font-mono text-text-secondary/60">
                                  Page {bm.page}
                                </span>
                              </button>
                              <button
                                onClick={() => handleDeleteBookmark(bm.createdAt)}
                                className="p-1 rounded text-text-secondary hover:text-error hover:bg-black/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Delete Bookmark"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-xs text-text-secondary/45 italic">
                            No custom bookmarks saved.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Outline table of contents */}
                  {sidebarTab === 'outline' && (
                    <div className="flex flex-col gap-1.5 text-xs">
                      {outline.length > 0 ? (
                        outline.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => item.pageNumber && setCurrentPage(item.pageNumber)}
                            disabled={!item.pageNumber}
                            className="w-full text-left p-2.5 rounded-lg hover:bg-surface-raised/40 hover:text-primary transition-all flex justify-between items-baseline gap-4"
                          >
                            <span className="font-medium truncate">{item.title}</span>
                            {item.pageNumber && (
                              <span className="font-mono text-[10px] text-text-secondary/60 shrink-0">
                                {item.pageNumber}
                              </span>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="py-6 text-center text-xs text-text-secondary/45 italic">
                          No built-in table of contents found.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main scrolling reader view */}
          <div className="flex-1 h-full overflow-auto flex items-center justify-center p-6 bg-[#161311] relative select-none">
            {/* Nav click zones on left and right for easy flipping */}
            <div 
              onClick={handlePrevPage}
              className="absolute left-0 top-0 bottom-0 w-[12%] z-10 cursor-w-resize hover:bg-white/[0.01]"
              title="Previous Page"
            />
            <div 
              onClick={handleNextPage}
              className="absolute right-0 top-0 bottom-0 w-[12%] z-10 cursor-e-resize hover:bg-white/[0.01]"
              title="Next Page"
            />

            {/* Document Canvas Sheet */}
            <div className="shadow-2xl border border-border/30 rounded bg-white relative max-w-full overflow-hidden">
              <canvas ref={canvasRef} className="block mx-auto max-w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback View: Library PDF Directory
  return (
    <div className="w-full min-h-full px-6 py-8 md:px-10 md:py-12 max-w-7xl mx-auto flex flex-col gap-8 pb-20 md:pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-text-primary tracking-tight">
          E-Reader Library
        </h1>
        <p className="text-text-secondary text-sm md:text-base mt-2 font-sans">
          Access your digital library documents and read them completely offline.
        </p>
      </div>

      {/* Book list */}
      {pdfBooksList && pdfBooksList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
          {pdfBooksList.map(({ pdf, book }) => {
            if (!book) return null;
            const progress = pdf.totalPages > 0 ? Math.round((pdf.lastPage / pdf.totalPages) * 100) : 0;
            return (
              <div 
                key={pdf.bookId}
                className="flex items-center gap-5 p-4 rounded-2xl border border-border bg-surface shadow-sm hover:border-primary/45 transition-colors group"
              >
                {/* Book Cover */}
                <div className="w-16 h-24 rounded border border-border/80 overflow-hidden shrink-0 bg-surface-raised relative flex items-center justify-center shadow-sm">
                  {book.coverUrl ? (
                    <img 
                      src={book.coverUrl} 
                      alt={book.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-2">
                      <span className="font-serif text-[9px] font-bold text-primary truncate max-w-full px-1">{book.title}</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between py-0.5 truncate gap-3.5">
                  <div className="truncate flex flex-col gap-0.5">
                    <h3 className="font-serif text-base font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                      {book.title}
                    </h3>
                    <span className="text-xs text-text-secondary truncate">
                      {book.authors?.join(', ') || 'Unknown Author'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="flex justify-between items-baseline text-[10px] font-mono text-text-secondary/70">
                      <span>PROGRESS</span>
                      <span>{progress}% (Page {pdf.lastPage} of {pdf.totalPages})</span>
                    </div>
                    {/* Linear Progress bar */}
                    <div className="w-full h-1 bg-border/40 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <button
                      onClick={() => navigate(`/reader?bookId=${encodeURIComponent(book.workId)}`)}
                      className="mt-1 self-start text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1.5 focus:outline-none"
                    >
                      <BookOpen size={12} />
                      <span>Resume Reading</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 border border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-6">
          <BookOpen className="h-10 w-10 text-text-secondary/40 mb-3 stroke-[1.2]" />
          <h3 className="font-serif text-base font-semibold text-text-primary">Digital Library is Empty</h3>
          <p className="text-text-secondary text-xs max-w-sm mt-1">
            Associate PDFs with books in your library shelves. Open a book details view, upload a PDF in the companion panel, and read it here.
          </p>
          <Link
            to="/shelf"
            className="mt-5 px-5 py-2.5 rounded-xl bg-surface border border-border text-xs text-primary font-bold hover:text-primary-hover active:scale-[0.98] transition-all"
          >
            Go to Library Shelves
          </Link>
        </div>
      )}
    </div>
  );
}
