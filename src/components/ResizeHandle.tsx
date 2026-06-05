'use client'

// 左右ペインのリサイザーバー。useResizableSplit と組で使う。
// モバイル（md 未満）は一覧/詳細を一画面ずつ切替表示するため hidden、md+ で表示。
export function ResizeHandle({
  dragging,
  onStart,
  onReset,
  className = 'hidden md:block',
}: {
  dragging: boolean
  onStart: () => void
  onReset: () => void
  /** 表示制御等の追加クラス。既定で md 未満は非表示。 */
  className?: string
}) {
  return (
    <div
      onMouseDown={onStart}
      onDoubleClick={onReset}
      className={`relative w-1 flex-shrink-0 cursor-col-resize group ${dragging ? 'bg-teal-400' : 'bg-gray-200 hover:bg-teal-300'} ${className}`}
      title="ドラッグで幅を調整 / ダブルクリックで 50% にリセット"
    >
      {/* 当たり判定を太くするオーバーレイ */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
