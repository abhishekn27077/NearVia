import { Star, StarHalf } from "lucide-react";

interface RatingStarsProps {
  rating: number | null;
  count?: number;
  className?: string;
  starClassName?: string;
  showCount?: boolean;
}

export function RatingStars({
  rating,
  count,
  className,
  starClassName,
  showCount = true,
}: RatingStarsProps) {
  if (rating === null || rating === 0 || (count !== undefined && count === 0)) {
    return (
      <div className={`flex items-center text-slate-400 ${className || ""}`}>
        <span className="text-xs font-medium">★ New (No reviews yet)</span>
      </div>
    );
  }

  // Round to nearest half
  const displayRating = Math.round(rating * 2) / 2;

  return (
    <div className={`flex items-center ${className || ""}`}>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((value) => {
          if (value <= displayRating) {
            return (
              <Star
                key={value}
                className={`w-4 h-4 fill-yellow-400 text-yellow-400 ${starClassName || ""}`}
              />
            );
          }
          if (value - 0.5 === displayRating) {
            return (
              <StarHalf
                key={value}
                className={`w-4 h-4 fill-yellow-400 text-yellow-400 ${starClassName || ""}`}
              />
            );
          }
          return (
            <Star
              key={value}
              className={`w-4 h-4 text-slate-300 ${starClassName || ""}`}
            />
          );
        })}
      </div>
      {showCount && count !== undefined && (
        <span className="ml-2 text-sm text-slate-500">
          {rating.toFixed(1)} ({count})
        </span>
      )}
    </div>
  );
}
