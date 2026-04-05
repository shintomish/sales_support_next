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
  return (
    <th
      className={`font-semibold text-gray-600 py-3 px-4 text-left cursor-pointer select-none hover:bg-blue-50/60 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <span className={`text-[10px] ${isActive ? 'text-blue-400' : 'text-gray-300'}`}>
          {isActive ? (sortOrder === 'asc' ? '↑' : '↓') : '⇅'}
        </span>
      </span>
    </th>
  );
}
