'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import SortableHeader from '@/components/SortableHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface RequiredSkill {
  skill_id: number; skill_name: string; category: string | null;
  is_required: boolean; min_experience_years: number | null;
}
interface PublicProject {
  id: number; title: string; description: string | null;
  posted_by_customer_name: string | null;
  unit_price_min: number | null; unit_price_max: number | null;
  contract_type: string | null; start_date: string | null;
  work_style: string | null; remote_frequency: string | null;
  nearest_station: string | null;
  headcount: number; status: string;
  views_count: number; applications_count: number;
  published_at: string | null; expires_at: string | null;
  required_skills: RequiredSkill[];
  is_favorite: boolean;
}
interface Meta { current_page: number; last_page: number; total: number; }
type ViewMode = 'card' | 'list' | 'kanban';

const WORK_STYLE_LABEL: Record<string, string> = { remote: '🏠 フルリモート', office: '🏢 出社', hybrid: '🔄 ハイブリッド' };
const SKILL_COLOR: Record<string, string> = {
  language: 'bg-blue-100 text-blue-700', framework: 'bg-purple-100 text-purple-700',
  database: 'bg-green-100 text-green-700', infrastructure: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
};
const STATUS_STYLE: Record<string, string> = {
  open:   'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
  filled: 'bg-blue-100 text-blue-700',
};
const STATUS_LABEL: Record<string, string> = { open: '募集中', closed: '募集終了', filled: '充足' };
const KANBAN_COLS = [
  { key: 'open',   label: '募集中',   headerCls: 'bg-green-50 border-green-200',  badgeCls: 'bg-green-500' },
  { key: 'filled', label: '充足',     headerCls: 'bg-blue-50 border-blue-200',    badgeCls: 'bg-blue-500' },
  { key: 'closed', label: '募集終了', headerCls: 'bg-gray-50 border-gray-200',    badgeCls: 'bg-gray-400' },
];
const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : null;
const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function PublicProjectsPage() {
  const router = useRouter();
  const [projects, setProjects]       = useState<PublicProject[]>([]);
  const [meta, setMeta]               = useState<Meta>({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [workStyle, setWorkStyle]     = useState('');
  const [priceFilter, setPriceFilter] = useState('');
  const [page, setPage]               = useState(1);
  const [viewMode, setViewMode]       = useState<ViewMode>('card');
  const [sortField, setSortField]     = useState<string>('');
  const [sortOrder, setSortOrder]     = useState<'asc' | 'desc'>('asc');
  const handleSort = (field: string) => {
    if (sortField === field) { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  };

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const perPage = viewMode === 'kanban' ? 200 : 20;
      const res = await apiClient.get('/api/v1/public-projects', {
        params: {
          search: search || undefined,
          work_style: workStyle || undefined,
          unit_price_min: priceFilter || undefined,
          page,
          per_page: perPage,
          sort_by: sortField || undefined,
          sort_order: sortField ? sortOrder : undefined,
        },
      });
      setProjects(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [search, workStyle, priceFilter, page, viewMode, sortField, sortOrder, router]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const switchView = (v: ViewMode) => { setViewMode(v); setPage(1); };

  const toggleFavorite = async (e: React.MouseEvent, project: PublicProject) => {
    e.stopPropagation();
    try {
      await apiClient.post(`/api/v1/public-projects/${project.id}/favorite`);
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, is_favorite: !p.is_favorite } : p));
    } catch {}
  };

  return (
    <div className={viewMode === 'kanban' ? 'py-6 px-6' : 'max-w-6xl mx-auto py-8 px-6'}>
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">案件マーケット</h1>
          <p className="text-sm text-gray-500 mt-1">全 {meta.total} 件</p>
        </div>
        <div className="flex items-center gap-3">
          {/* ビュー切替 */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {([
              { v: 'card',   icon: '⊞',  label: 'カード' },
              { v: 'list',   icon: '📋', label: 'リスト' },
              { v: 'kanban', icon: '🗂',  label: 'カンバン' },
            ] as { v: ViewMode; icon: string; label: string }[]).map(({ v, icon, label }) => (
              <button key={v} onClick={() => switchView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
                  viewMode === v ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                <span>{icon}</span><span>{label}</span>
              </button>
            ))}
          </div>
          <Button onClick={() => router.push('/public-projects/create')}>+ 新規掲載</Button>
        </div>
      </div>

      {/* 検索フィルタ */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input placeholder="案件名・説明で検索..." value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchProjects(); } }}
          className="max-w-xs" />
        <select value={workStyle} onChange={e => { setWorkStyle(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">勤務形態：すべて</option>
          <option value="remote">フルリモート</option>
          <option value="hybrid">ハイブリッド</option>
          <option value="office">出社</option>
        </select>
        <select value={priceFilter} onChange={e => { setPriceFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">単価：すべて</option>
          <option value="50">50万円以上</option>
          <option value="60">60万円以上</option>
          <option value="70">70万円以上</option>
          <option value="80">80万円以上</option>
        </select>
        <Button variant="outline" onClick={() => { setPage(1); fetchProjects(); }}>検索</Button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p>案件が見つかりません</p>
        </div>
      )}

      {/* ── カードビュー ── */}
      {!loading && projects.length > 0 && viewMode === 'card' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {projects.map(p => (
              <ProjectCard key={p.id} p={p}
                onClick={() => router.push(`/public-projects/${p.id}`)}
                onFavorite={e => toggleFavorite(e, p)} />
            ))}
          </div>
          <Pagination meta={meta} page={page} setPage={setPage} />
        </>
      )}

      {/* ── リストビュー ── */}
      {!loading && projects.length > 0 && viewMode === 'list' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3"></th>
                  <SortableHeader label="案件名" field="title" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="text-xs font-medium text-gray-500 px-4 py-3" />
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">顧客</th>
                  <SortableHeader label="ステータス" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="text-xs font-medium text-gray-500 px-4 py-3" />
                  <SortableHeader label="単価" field="unit_price_min" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="text-xs font-medium text-gray-500 px-4 py-3" />
                  <SortableHeader label="勤務形態" field="work_style" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="text-xs font-medium text-gray-500 px-4 py-3" />
                  {['開始', 'スキル', '応募'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map(p => (
                  <tr key={p.id} onClick={() => router.push(`/public-projects/${p.id}`)}
                    className="cursor-pointer hover:bg-blue-50 transition-colors">
                    <td className="px-3 py-3">
                      <button onClick={e => toggleFavorite(e, p)} className="text-lg hover:scale-110 transition-transform">
                        {p.is_favorite ? '♥' : '♡'}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-medium text-gray-800 truncate">{p.title}</p>
                      {p.nearest_station && <p className="text-xs text-gray-400">🚉 {p.nearest_station}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">
                      {p.posted_by_customer_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status] ?? STATUS_STYLE.open}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {(p.unit_price_min || p.unit_price_max)
                        ? `${p.unit_price_min ?? '?'}〜${p.unit_price_max ?? '?'}万`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.work_style ? WORK_STYLE_LABEL[p.work_style]?.replace(/^./, '') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(p.start_date) ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.required_skills.filter(s => s.is_required).slice(0, 3).map(s => (
                          <span key={s.skill_id}
                            className={`text-xs px-1.5 py-0.5 rounded-full ${SKILL_COLOR[s.category ?? 'other'] ?? SKILL_COLOR.other}`}>
                            {s.skill_name}
                          </span>
                        ))}
                        {p.required_skills.filter(s => s.is_required).length > 3 && (
                          <span className="text-xs text-gray-400">+{p.required_skills.filter(s => s.is_required).length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.applications_count}件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={meta} page={page} setPage={setPage} />
        </>
      )}

      {/* ── カンバンビュー ── */}
      {!loading && projects.length > 0 && viewMode === 'kanban' && (
        <div className="grid grid-cols-3 gap-4 items-start">
          {KANBAN_COLS.map(col => {
            const colProjects = projects.filter(p => p.status === col.key);
            return (
              <div key={col.key} className={`rounded-xl border ${col.headerCls} overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${col.headerCls} flex items-center justify-between`}>
                  <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  <span className={`text-xs text-white px-2 py-0.5 rounded-full ${col.badgeCls}`}>
                    {colProjects.length}
                  </span>
                </div>
                <div className="p-3 space-y-2 min-h-[200px]">
                  {colProjects.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6">なし</p>
                  )}
                  {colProjects.map(p => (
                    <div key={p.id} onClick={() => router.push(`/public-projects/${p.id}`)}
                      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium text-gray-800 leading-tight flex-1">{p.title}</p>
                        <button onClick={e => toggleFavorite(e, p)} className="ml-2 text-base flex-shrink-0 hover:scale-110 transition-transform">
                          {p.is_favorite ? '♥' : '♡'}
                        </button>
                      </div>
                      {p.posted_by_customer_name && (
                        <p className="text-xs text-gray-400 mb-1.5">{p.posted_by_customer_name}</p>
                      )}
                      {(p.unit_price_min || p.unit_price_max) && (
                        <p className="text-xs text-gray-600 mb-1.5">
                          💰 {p.unit_price_min ?? '?'}〜{p.unit_price_max ?? '?'}万
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {p.required_skills.filter(s => s.is_required).slice(0, 3).map(s => (
                          <span key={s.skill_id}
                            className={`text-xs px-1.5 py-0.5 rounded-full ${SKILL_COLOR[s.category ?? 'other'] ?? SKILL_COLOR.other}`}>
                            {s.skill_name}
                          </span>
                        ))}
                        {p.required_skills.filter(s => s.is_required).length > 3 && (
                          <span className="text-xs text-gray-400">+{p.required_skills.filter(s => s.is_required).length - 3}</span>
                        )}
                      </div>
                      {p.applications_count > 0 && (
                        <p className="text-xs text-gray-400 mt-1.5">📝 {p.applications_count}件</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── サブコンポーネント ──────────────────────────────────────

function ProjectCard({ p, onClick, onFavorite }: {
  p: PublicProject;
  onClick: () => void;
  onFavorite: (e: React.MouseEvent) => void;
}) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status] ?? STATUS_STYLE.open}`}>
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
              {p.posted_by_customer_name && (
                <span className="text-xs text-gray-400 truncate">{p.posted_by_customer_name}</span>
              )}
            </div>
            <h3 className="font-semibold text-gray-800 truncate">{p.title}</h3>
          </div>
          <button onClick={onFavorite} className="ml-3 text-xl flex-shrink-0 hover:scale-110 transition-transform">
            {p.is_favorite ? '♥' : '♡'}
          </button>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-3">
          {(p.unit_price_min || p.unit_price_max) && (
            <span className="font-medium text-gray-800">
              💰 {p.unit_price_min ?? '?'}〜{p.unit_price_max ?? '?'}万円/月
            </span>
          )}
          {p.work_style && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {WORK_STYLE_LABEL[p.work_style] ?? p.work_style}
            </span>
          )}
          {p.contract_type && <span className="text-xs text-gray-500">{p.contract_type}</span>}
        </div>
        <div className="flex gap-4 text-xs text-gray-500 mb-3">
          {p.start_date && <span>📅 {fmtDate(p.start_date)}〜</span>}
          {p.nearest_station && <span>🚉 {p.nearest_station}</span>}
          {p.remote_frequency && <span>🏠 {p.remote_frequency}</span>}
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {p.required_skills.slice(0, 4).map(s => (
            <span key={s.skill_id}
              className={`text-xs px-2 py-0.5 rounded-full ${
                s.is_required
                  ? (SKILL_COLOR[s.category ?? 'other'] ?? SKILL_COLOR.other)
                  : 'bg-gray-50 text-gray-400 border border-gray-200'
              }`}>
              {s.skill_name}
              {!s.is_required && <span className="ml-1 text-gray-400">(歓迎)</span>}
            </span>
          ))}
          {p.required_skills.length > 4 && (
            <span className="text-xs text-gray-400">+{p.required_skills.length - 4}</span>
          )}
        </div>
        <div className="flex gap-4 text-xs text-gray-400 border-t border-gray-50 pt-2">
          <span>👁 {p.views_count}</span>
          <span>📝 応募 {p.applications_count}件</span>
          {p.expires_at && <span>⏰ {fmtDate(p.expires_at)}まで</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Pagination({ meta, page, setPage }: { meta: Meta; page: number; setPage: (f: (p: number) => number) => void }) {
  if (meta.last_page <= 1) return null;
  return (
    <div className="flex justify-center items-center gap-4 mt-8">
      <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
      <span className="text-sm text-gray-500">{page} / {meta.last_page}</span>
      <Button variant="outline" disabled={page >= meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
    </div>
  );
}
