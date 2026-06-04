import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number; // 0 to 5, half-star precision
  onChange?: (rating: number) => void;
  size?: number;
  readOnly?: boolean;
}

export default function StarRating({ rating, onChange, size = 18, readOnly = false }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  const handleStarClick = (e: React.MouseEvent<HTMLDivElement>, val: number) => {
    if (readOnly || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    // If click on left half, set half rating (e.g. 3.5), else set full rating (e.g. 4.0)
    const isHalf = clickX < width / 2;
    const finalRating = isHalf ? val - 0.5 : val;
    
    // Toggle: if clicking the exact same rating, reset to 0
    if (rating === finalRating) {
      onChange(0);
    } else {
      onChange(finalRating);
    }
  };

  return (
    <div className="flex items-center gap-0.5 select-none">
      {stars.map((val) => {
        // Decide which star type to show
        let isFull = rating >= val;
        let isHalf = !isFull && rating >= val - 0.5;

        return (
          <div
            key={val}
            onClick={(e) => handleStarClick(e, val)}
            className={`relative flex items-center justify-center p-0.5 ${
              readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95 transition-transform'
            }`}
            style={{ width: size + 4, height: size + 4 }}
          >
            {isFull ? (
              <Star
                size={size}
                className="text-primary fill-primary"
                strokeWidth={1.5}
              />
            ) : isHalf ? (
              <div className="relative overflow-hidden" style={{ width: size, height: size }}>
                {/* Empty star background */}
                <Star
                  size={size}
                  className="text-text-secondary/30 absolute top-0 left-0"
                  strokeWidth={1.5}
                />
                {/* Half star overlay */}
                <div className="absolute top-0 left-0 overflow-hidden" style={{ width: '50%', height: size }}>
                  <Star
                    size={size}
                    className="text-primary fill-primary"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            ) : (
              <Star
                size={size}
                className="text-text-secondary/30"
                strokeWidth={1.5}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
