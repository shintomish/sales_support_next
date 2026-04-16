'use client';

interface Props {
  label: string;
  field: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}

export default function SortableHeader({ label, field, sortField, sortOrder, onSort, className = '' }: Props) {
  const isActive = sortField === field;
  const isAsc    = isActive && sortOrder === 'asc';

  return (
    <th
      className={`font-semibold py-3 px-4 text-left cursor-pointer select-none transition-colors group ${
        isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-blue-50/60'
      } ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className={isActive ? 'font-bold' : ''}>{label}</span>
        {isActive ? (
          <span className="inline-flex items-center justify-center bg-blue-600 text-white rounded-md px-1.5 py-0.5 text-[10px] font-bold gap-0.5 shadow-sm">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              {isAsc ? (
                <path d="M5 1L9 8H1L5 1Z" />
              ) : (
                <path d="M5 9L1 2H9L5 9Z" />
              )}
            </svg>
            <span>{isAsc ? '昇順' : '降順'}</span>
          </span>
        ) : (
          <span className="inline-flex flex-col leading-none text-gray-300 group-hover:text-gray-500 transition-colors">
            <svg width="9" height="6" viewBox="0 0 10 7" fill="currentColor" aria-hidden="true">
              <path d="M5 0L10 7H0L5 0Z" />
            </svg>
            <svg width="9" height="6" viewBox="0 0 10 7" fill="currentColor" aria-hidden="true" className="mt-[2px]">
              <path d="M5 7L0 0H10L5 7Z" />
            </svg>
          </span>
        )}
      </span>
    </th>
  );
}
