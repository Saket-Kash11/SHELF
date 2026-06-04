import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Library, ArrowUpDown, Tag, Sparkles } from 'lucide-react';
import { db } from '../db/schema';
import BookCard from '../components/BookCard';
import { TAXONOMY, type TagCategory } from '../ml/taxonomy';

type SortOption = 'frequency' | 'alphabetical' | 'category';

export default function TagBrowser() {
  const params = useParams();
  const navigate = useNavigate();
  const tagName = params.tagName; // Extract tag name from route if we are in detail view

  const [sortBy, setSortBy] = useState<SortOption>('frequency');

  // Query all tag records to calculate frequencies
  const allTagRecords = useLiveQuery(() => db.bookTags.toArray()) || [];

  // Query books for the tag detail view
  const matchingBooks = useLiveQuery(async () => {
    if (!tagName) return [];
    
    // Find all bookTag records that contain the selected tag
    const records = await db.bookTags
      .filter((record) => record.tags.includes(tagName))
      .toArray();
      
    const bookIds = records.map((r) => r.bookId);
    if (bookIds.length === 0) return [];
    
    // Fetch books details
    return await db.books.where('workId').anyOf(bookIds).toArray();
  }, [tagName, allTagRecords]);

  // Compute tag frequencies
  const tagCounts: Record<string, number> = {};
  allTagRecords.forEach((record) => {
    record.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const tagList = Object.keys(tagCounts).map((tag) => ({
    name: tag,
    count: tagCounts[tag],
    category: getTagCategory(tag)
  }));

  const maxCount = tagList.length > 0 ? Math.max(...tagList.map((t) => t.count)) : 0;

  // Sorting logic
  if (sortBy === 'frequency') {
    tagList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  } else if (sortBy === 'alphabetical') {
    tagList.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'category') {
    tagList.sort((a, b) => a.category.localeCompare(b.category) || b.count - a.count);
  }

  // Helper to determine tag category for sorting/coloring
  function getTagCategory(tag: string): TagCategory {
    const categories = Object.keys(TAXONOMY) as TagCategory[];
    for (const cat of categories) {
      if ((TAXONOMY[cat] as readonly string[]).includes(tag)) {
        return cat;
      }
    }
    return 'genre'; // Default fallback
  }

  // 1. Render Tag Detail View (All books for a specific tag)
  if (tagName) {
    return (
      <div className="w-full min-h-full px-6 py-8 md:px-10 md:py-12 max-w-7xl mx-auto flex flex-col">
        {/* Header Navigation */}
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <button
            onClick={() => navigate('/tags')}
            className="flex items-center justify-center h-9 w-9 rounded-full bg-surface border border-border text-text-primary hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-mono text-text-secondary uppercase tracking-wider">Tag Browser</span>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2.5">
            <Tag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-text-primary">
              {tagName}
            </h1>
          </div>
          <p className="text-text-secondary text-sm font-sans mt-1.5">
            Found {matchingBooks.length} book{matchingBooks.length === 1 ? '' : 's'} categorized under this tag.
          </p>
        </div>

        {/* Book Grid */}
        {matchingBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
            {matchingBooks.map((book) => (
              <BookCard key={book.workId} book={book} />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <Library className="h-12 w-12 text-text-secondary/40 mb-4 stroke-[1.5]" />
            <h3 className="font-serif text-lg font-semibold text-text-primary">No books found</h3>
            <p className="text-text-secondary text-sm max-w-xs mt-1.5 leading-relaxed">
              There are no books currently shelved that contain this tag.
            </p>
          </div>
        )}
      </div>
    );
  }

  // 2. Render Tag List View (Cloud of all tags)
  return (
    <div className="w-full min-h-full px-6 py-8 md:px-10 md:py-12 max-w-7xl mx-auto flex flex-col">
      <div className="mb-8 shrink-0">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-text-primary tracking-tight">
          Library Tags
        </h1>
        <p className="text-text-secondary text-sm md:text-base mt-2 font-sans">
          Browse and filter books by mood, pace, setting, theme, and genre categories.
        </p>
      </div>

      {tagList.length > 0 ? (
        <>
          {/* Sorting / Filter Toolbar */}
          <div className="flex items-center justify-between pb-4 border-b border-border/40 mb-6 shrink-0">
            <span className="text-[10px] font-mono uppercase text-text-secondary/60 tracking-wider">
              {tagList.length} ACTIVE TAGS
            </span>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-text-secondary" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-surface border border-border rounded-lg text-xs text-text-primary py-1 px-2.5 focus:outline-none focus:border-primary font-sans font-medium"
              >
                <option value="frequency">Frequency</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>

          {/* Typographic Cloud Grid */}
          <div className="flex flex-wrap items-center justify-start gap-3 p-1">
            {tagList.map((tag) => {
              // Sizing logic
              const scale = maxCount > 0 ? tag.count / maxCount : 0;
              let sizeClass = 'text-xs px-2.5 py-1 text-text-secondary/90 bg-surface border-border';
              let weightClass = 'font-normal';
              let borderClass = 'border';

              if (scale >= 0.8) {
                sizeClass = 'text-base md:text-lg px-4 py-2 bg-primary/10 text-primary border-primary/45';
                weightClass = 'font-bold';
              } else if (scale >= 0.5) {
                sizeClass = 'text-sm md:text-base px-3.5 py-1.5 bg-surface-raised text-text-primary border-border/80';
                weightClass = 'font-semibold';
              } else if (scale >= 0.25) {
                sizeClass = 'text-xs md:text-sm px-3 py-1.2 bg-surface text-text-primary border-border/60';
                weightClass = 'font-medium';
              }

              // Color dot indicator based on category
              let dotColor = 'bg-gray-500';
              switch (tag.category) {
                case 'mood': dotColor = 'bg-tag-mood'; break;
                case 'pace': dotColor = 'bg-tag-pace'; break;
                case 'setting': dotColor = 'bg-tag-setting'; break;
                case 'theme': dotColor = 'bg-tag-theme'; break;
                case 'genre': dotColor = 'bg-tag-genre'; break;
              }

              return (
                <Link
                  key={tag.name}
                  to={`/tags/${encodeURIComponent(tag.name)}`}
                  className={`inline-flex items-center gap-2 rounded-xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer ${sizeClass} ${weightClass} ${borderClass} shadow-sm hover:shadow-md`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  <span>{tag.name}</span>
                  <span className="text-[10px] font-mono text-text-secondary/50 font-normal">({tag.count})</span>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="h-12 w-12 text-primary/40 mb-4 stroke-[1.5]" />
          <h3 className="font-serif text-lg font-semibold text-text-primary">No tags registered</h3>
          <p className="text-text-secondary text-sm max-w-xs mt-1.5 leading-relaxed">
            Your library is empty or unshelved. Add books to shelves to let the classifier tag them automatically.
          </p>
        </div>
      )}
    </div>
  );
}
