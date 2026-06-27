'use client';

/**
 * お気に入り★トグルボタン（一覧行用）。
 * クリックは親の行選択に伝播させない（stopPropagation）。
 */
export default function FavStar({
  active,
  onToggle,
  size = 'sm',
}: {
  active: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={active ? 'お気に入りから外す' : 'お気に入りに追加'}
      aria-label={active ? 'お気に入りから外す' : 'お気に入りに追加'}
      className={`flex-shrink-0 leading-none transition-colors ${size === 'md' ? 'text-lg' : 'text-sm'} ${
        active ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400'
      }`}
    >
      {active ? '★' : '☆'}
    </button>
  );
}
