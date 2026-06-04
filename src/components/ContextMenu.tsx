import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Star, FileText, Move, Trash2, X, Check } from 'lucide-react';
import StarRating from './StarRating';
import type { Book } from '../types/book';
import type { Shelf } from '../db/schema';

interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  x: number; // Click X coordinate (0 for mobile)
  y: number; // Click Y coordinate (0 for mobile)
  book: Book;
  allShelves: Shelf[];
  currentShelfId: number;
  currentRating: number;
  currentNote: string;
  onMoveShelf: (shelfId: number) => void;
  onRemove: () => void;
  onRate: (rating: number) => void;
  onSaveNote: (note: string) => void;
}

export default function ContextMenu({
  isOpen,
  onClose,
  x,
  y,
  book,
  allShelves,
  currentShelfId,
  currentRating,
  currentNote,
  onMoveShelf,
  onRemove,
  onRate,
  onSaveNote
}: ContextMenuProps) {
  const [noteText, setNoteText] = useState(currentNote);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNoteText(currentNote);
  }, [currentNote, isOpen]);

  // Handle click outside to close (desktop only)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (x !== 0 && y !== 0 && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, x, y, onClose]);

  if (!isOpen) return null;

  const isMobile = x === 0 && y === 0;

  const handleSaveNote = () => {
    onSaveNote(noteText.slice(0, 500));
    setIsEditingNote(false);
  };

  const otherShelves = allShelves.filter(s => s.id !== currentShelfId);

  // Render context menu layout
  const renderMenuContent = () => (
    <div className="flex flex-col gap-4 text-text-primary">
      {/* Book header summary */}
      <div className="flex gap-3 pb-3 border-b border-border/40 shrink-0">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className="w-10 h-15 object-cover rounded border border-border/50" />
        ) : (
          <div className="w-10 h-15 bg-surface-raised rounded border border-border/50 flex items-center justify-center text-[8px] text-primary/70 text-center leading-tight p-0.5">{book.title}</div>
        )}
        <div className="flex flex-col justify-center max-w-[200px]">
          <h4 className="font-serif text-sm font-bold truncate">{book.title}</h4>
          <p className="font-sans text-xs text-text-secondary truncate mt-0.5">{book.authors?.join(', ')}</p>
        </div>
        {isMobile && (
          <button onClick={onClose} className="ml-auto text-text-secondary hover:text-text-primary p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* 1. Rating Selector */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <span className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider flex items-center gap-1">
          <Star size={10} className="fill-primary text-primary" />
          <span>YOUR RATING</span>
        </span>
        <div className="px-1 py-1 bg-surface rounded-lg border border-border/50 w-fit">
          <StarRating rating={currentRating} onChange={onRate} size={20} />
        </div>
      </div>

      {/* 2. Note Editor */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <span className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider flex items-center gap-1">
          <FileText size={10} className="text-primary" />
          <span>READING NOTE</span>
        </span>
        {isEditingNote ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add your reading thoughts (max 500 chars)..."
              maxLength={500}
              rows={3}
              className="w-full bg-surface border border-border rounded-lg text-xs p-2.5 focus:outline-none focus:border-primary text-text-primary placeholder:text-text-secondary/40 font-sans resize-none"
              autoFocus
            />
            <div className="flex justify-between items-center text-[10px] text-text-secondary">
              <span>{noteText.length}/500</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setNoteText(currentNote); setIsEditingNote(false); }}
                  className="px-2 py-1 rounded bg-surface border border-border hover:bg-surface-raised font-semibold font-sans"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-2 py-1 rounded bg-primary text-bg font-semibold font-sans hover:bg-primary-hover flex items-center gap-0.5"
                >
                  <Check size={10} strokeWidth={3} />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditingNote(true)}
            className="w-full bg-surface border border-border hover:bg-surface-raised/40 transition-colors rounded-lg p-2.5 text-xs text-text-secondary/80 min-h-[48px] cursor-pointer relative group flex flex-col justify-between"
          >
            <p className="italic line-clamp-2">
              {currentNote || 'Tap to add private reading notes...'}
            </p>
            {currentNote && (
              <span className="text-[9px] font-sans font-semibold text-primary/80 self-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Edit Note</span>
            )}
          </div>
        )}
      </div>

      {/* 3. Move Shelf Dropdown list */}
      {otherShelves.length > 0 && (
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-wider flex items-center gap-1">
            <Move size={10} className="text-primary" />
            <span>MOVE TO LIST</span>
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {otherShelves.map((shelf) => (
              <button
                key={shelf.id}
                onClick={() => { onMoveShelf(shelf.id!); onClose(); }}
                className="flex items-center gap-2 p-2 rounded-lg bg-surface hover:bg-surface-raised border border-border/40 text-left text-xs font-sans text-text-primary hover:border-primary/45 transition-all truncate"
              >
                <span>{shelf.emoji}</span>
                <span className="truncate">{shelf.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Remove book entirely from list */}
      <button
        onClick={() => { onRemove(); onClose(); }}
        className="mt-2 w-full py-2.5 rounded-xl border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 font-sans font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
      >
        <Trash2 size={13} />
        <span>Remove from Shelf</span>
      </button>
    </div>
  );

  // Mobile layout: Bottom Sheet Overlay
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        {/* Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        {/* Sliding Sheet */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 260 }}
          className="absolute bottom-0 w-full max-w-md bg-surface-raised border-t border-border rounded-t-2xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto"
        >
          {/* Drag handle line */}
          <div className="w-12 h-1 bg-border/80 rounded-full mx-auto mb-6" />
          {renderMenuContent()}
        </motion.div>
      </div>
    );
  }

  // Desktop layout: Coordinates Absolute Positioning Context Menu
  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface-raised border border-border rounded-xl p-5 shadow-2xl w-[320px] max-h-[550px] overflow-y-auto"
      style={{
        top: Math.min(y, window.innerHeight - 450),
        left: Math.min(x, window.innerWidth - 340),
      }}
    >
      {renderMenuContent()}
    </div>
  );
}
