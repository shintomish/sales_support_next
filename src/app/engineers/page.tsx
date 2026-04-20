'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import SortableHeader from '@/components/SortableHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Skill {
  skill_id: number;
  skill_name: string;
  category: string | null;
  experience_years: number;
  proficiency_level: number;
}
interface Engineer {
  id: number;
  name: string;
  name_kana: string | null;
  email: string | null;
  affiliation: string | null;
  age: number | null;
  affiliation_type: string | null;
  engineer_mail_source_id: number | null;
  profile: {
    desired_unit_price_min: number | null;
    desired_unit_price_max: number | null;
    available_from: string | null;
    availability_status: string | null;
    work_style: string | null;
    is_public: boolean;
  } | null;
  skills: Skill[];
}
interface Meta { current_page: number; last_page: number; total: number; }

type ViewMode = 'card' | 'list' | 'kanban';

const WORK_STYLE_LABEL: Record<string, string> = {
  remote: 'フルリモート', office: '出社', hybrid: '出社、リモートどちらも対応',
};
const AVAILABILITY_BADGE: Record<string, { label: string; cls: string }> = {
  available: { label: '空き',    cls: 'bg-green-100 text-green-700' },
  working:   { label: '稼働中',  cls: 'bg-orange-100 text-orange-700' },
  scheduled: { label: '◯月予定', cls: 'bg-blue-100 text-blue-700' },
};
const KANBAN_COLS = [
  { key: 'available', label: '空き',    headerCls: 'bg-green-50 border-green-200',  badgeCls: 'bg-green-500' },
  { key: 'working',   label: '稼働中',  headerCls: 'bg-orange-50 border-orange-200', badgeCls: 'bg-orange-500' },
  { key: 'scheduled', label: '◯月予定', headerCls: 'bg-blue-50 border-blue-200',    badgeCls: 'bg-blue-500' },
  { key: '',          label: '未設定',  headerCls: 'bg-gray-50 border-gray-200',    badgeCls: 'bg-gray-400' },
];
const SKILL_CATEGORY_COLOR: Record<string, string> = {
  language:       'bg-blue-100 text-blue-700',
  framework:      'bg-purple-100 text-purple-700',
  database:       'bg-green-100 text-green-700',
  infrastructure: 'bg-orange-100 text-orange-700',
  other:          'bg-gray-300 text-gray-700',
};
const AFFILIATION_TYPE_LABEL: Record<string, string> = {
  self: '自社正社員', first_sub: '一社先正社員', bp: 'BP', bp_member: 'BP要員',
  contract: '契約社員', freelance: '個人事業主', joining: '入社予定', hiring: '採用予定',
};
const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

export default function EngineersPage() {
  const router = useRouter();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [meta, setMeta]           = useState<Meta>({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading]     = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]       = useState('');
  const [workStyle, setWorkStyle] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage]           = useState(1);
  const [viewMode, setViewMode]   = useState<ViewMode>('card');
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const handleSort = (field: string) => {
    if (sortField === field) { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  };

  const fetchEngineers = useCallback(async () => {
    setLoading(true);
    try {
      const perPage = viewMode === 'kanban' ? 200 : 20;
      const res = await apiClient.get('/api/v1/engineers', {
        params: { search: search || undefined, work_style: workStyle || undefined, source: sourceFilter || undefined, page, per_page: perPage, sort_by: sortField || undefined, sort_order: sortField ? sortOrder : undefined },
      });
      setEngineers(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [search, workStyle, sourceFilter, page, viewMode, sortField, sortOrder, router]);

  // テキスト入力のデバウンス（300ms）
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { fetchEngineers(); }, [fetchEngineers]);

  const switchView = (v: ViewMode) => { setViewMode(v); setPage(1); };

  const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className={
      viewMode === 'kanban' ? 'py-6 px-6' :
      viewMode === 'list'   ? 'flex flex-col h-screen py-8 px-6 max-w-6xl mx-auto' :
                              'max-w-6xl mx-auto py-8 px-6'
    }>
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">技術者管理</h1>
          <p className="text-sm text-gray-500 mt-1">全 {meta.total} 名</p>
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
                  viewMode === v
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                <span>{icon}</span><span>{label}</span>
              </button>
            ))}
          </div>
          <Button onClick={() => router.push('/engineers/create')}>+ 新規登録</Button>
        </div>
      </div>

      {/* 検索フィルタ */}
      <div className="flex gap-3 mb-6 flex-shrink-0">
        <Input placeholder="氏名・所属で検索..." value={searchInput}
          onChange={e => setSearchInput(e.target.value)} className="max-w-xs" />
        <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">区分：すべて</option>
          <option value="self">自社社員</option>
          <option value="bp">BP社員</option>
          <option value="mail">メール登録</option>
        </select>
        <select value={workStyle} onChange={e => { setWorkStyle(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">勤務形態：すべて</option>
          <option value="remote">フルリモート</option>
          <option value="hybrid">出社、リモートどちらも対応</option>
          <option value="office">出社</option>
        </select>
      </div>

      {loading && (
        <div className="flex justify-center py-16 flex-shrink-0">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && engineers.length === 0 && viewMode !== 'list' && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🧑‍💻</p>
          <p>技術者が見つかりません</p>
        </div>
      )}

      {/* ── カードビュー ── */}
      {!loading && viewMode === 'card' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {engineers.map(e => <EngineerCard key={e.id} e={e} onClick={() => router.push(`/engineers/${e.id}`)} />)}
          </div>
          <Pagination meta={meta} page={page} setPage={setPage} />
        </>
      )}

      {/* ── リストビュー ── */}
      {!loading && viewMode === 'list' && (
        <>
          <Card className="shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
            <CardContent className="p-0 flex flex-col h-full overflow-hidden">

              {/* テーブルヘッダー（固定） */}
              <div className="flex-shrink-0 border-b bg-gray-50">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '22%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader label="氏名" field="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="text-xs font-semibold text-gray-600 px-4 py-3" />
                      <SortableHeader label="所属" field="affiliation" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="text-xs font-semibold text-gray-600 px-4 py-3" />
                      {['所属区分', '年齢', '稼働状況', '希望単価'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>
                      ))}
                      <SortableHeader label="稼働可能日" field="available_from" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="text-xs font-semibold text-gray-600 px-4 py-3" />
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">スキル</th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* テーブルボディ（スクロール） */}
              <div className="overflow-y-auto flex-1">
                {engineers.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 text-gray-400 py-16">
                    <span className="text-5xl">🧑‍💻</span>
                    <p className="text-sm">技術者が見つかりません</p>
                  </div>
                ) : (
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '22%' }} />
                    </colgroup>
                    <tbody className="divide-y divide-gray-100">
                      {engineers.map((e, index) => (
                        <tr key={e.id} onClick={() => router.push(`/engineers/${e.id}`)}
                          className={`cursor-pointer hover:bg-blue-50/60 transition-colors border-b last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-blue-600 truncate">{e.name}</p>
                            {e.name_kana && <p className="text-xs text-gray-400 truncate">{e.name_kana}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs truncate">{e.affiliation ?? '—'}</td>
                          <td className="px-4 py-3">
                            {e.affiliation_type
                              ? <span className={`text-xs px-2 py-0.5 rounded-full ${e.affiliation_type === 'self' ? 'bg-indigo-100 text-indigo-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {AFFILIATION_TYPE_LABEL[e.affiliation_type]}
                                </span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{e.age ? `${e.age}歳` : '—'}</td>
                          <td className="px-4 py-3">
                            {e.profile?.availability_status && AVAILABILITY_BADGE[e.profile.availability_status]
                              ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AVAILABILITY_BADGE[e.profile.availability_status].cls}`}>
                                  {AVAILABILITY_BADGE[e.profile.availability_status].label}
                                </span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {(e.profile?.desired_unit_price_min || e.profile?.desired_unit_price_max)
                              ? `${e.profile?.desired_unit_price_min ?? '?'}〜${e.profile?.desired_unit_price_max ?? '?'}万`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(e.profile?.available_from ?? null)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {e.skills.slice(0, 3).map((s, i) => (
                                <span key={s.skill_id ?? i}
                                  className={`text-xs px-1.5 py-0.5 rounded-full ${SKILL_CATEGORY_COLOR[s.category ?? 'other'] ?? SKILL_CATEGORY_COLOR.other}`}>
                                  {s.skill_name}
                                </span>
                              ))}
                              {e.skills.length > 3 && <span className="text-xs text-gray-400">+{e.skills.length - 3}</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </CardContent>
          </Card>
          <div className="flex-shrink-0">
            <Pagination meta={meta} page={page} setPage={setPage} />
          </div>
        </>
      )}

      {/* ── カンバンビュー ── */}
      {!loading && viewMode === 'kanban' && (
        <div className="grid grid-cols-4 gap-4 items-start">
          {KANBAN_COLS.map(col => {
            const colEngineers = engineers.filter(e =>
              (e.profile?.availability_status ?? '') === col.key
            );
            return (
              <div key={col.key} className={`rounded-xl border ${col.headerCls} overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${col.headerCls} flex items-center justify-between`}>
                  <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  <span className={`text-xs text-white px-2 py-0.5 rounded-full ${col.badgeCls}`}>
                    {colEngineers.length}
                  </span>
                </div>
                <div className="p-3 space-y-2 min-h-[200px]">
                  {colEngineers.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6">なし</p>
                  )}
                  {colEngineers.map(e => (
                    <div key={e.id} onClick={() => router.push(`/engineers/${e.id}`)}
                      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{e.name}</p>
                          {e.affiliation && <p className="text-xs text-gray-400">{e.affiliation}</p>}
                        </div>
                        {e.affiliation_type && (
                          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${e.affiliation_type === 'self' ? 'bg-indigo-100 text-indigo-600' : 'bg-yellow-100 text-yellow-700'}`}>
                            {AFFILIATION_TYPE_LABEL[e.affiliation_type]}
                          </span>
                        )}
                      </div>
                      {(e.profile?.desired_unit_price_min || e.profile?.desired_unit_price_max) && (
                        <p className="text-xs text-gray-500 mb-1.5">
                          💰 {e.profile?.desired_unit_price_min ?? '?'}〜{e.profile?.desired_unit_price_max ?? '?'}万
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {e.skills.slice(0, 3).map((s, i) => (
                          <span key={s.skill_id ?? i}
                            className={`text-xs px-1.5 py-0.5 rounded-full ${SKILL_CATEGORY_COLOR[s.category ?? 'other'] ?? SKILL_CATEGORY_COLOR.other}`}>
                            {s.skill_name}
                          </span>
                        ))}
                        {e.skills.length > 3 && <span className="text-xs text-gray-400">+{e.skills.length - 3}</span>}
                      </div>
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

function EngineerCard({ e, onClick }: { e: Engineer; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-gray-800">{e.name}</h3>
            {e.name_kana && <p className="text-xs text-gray-400">{e.name_kana}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {e.profile?.availability_status && AVAILABILITY_BADGE[e.profile.availability_status] && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AVAILABILITY_BADGE[e.profile.availability_status].cls}`}>
                {AVAILABILITY_BADGE[e.profile.availability_status].label}
              </span>
            )}
            {e.profile?.is_public
              ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">公開中</span>
              : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">非公開</span>
            }
            {e.profile?.work_style && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {WORK_STYLE_LABEL[e.profile.work_style] ?? e.profile.work_style}
              </span>
            )}
          </div>
        </div>
        {e.affiliation && <p className="text-xs text-gray-500 mb-2">🏢 {e.affiliation}</p>}
        <div className="flex gap-4 text-xs text-gray-600 mb-3">
          {(e.profile?.desired_unit_price_min || e.profile?.desired_unit_price_max) && (
            <span>💰 {e.profile?.desired_unit_price_min ?? '?'}〜{e.profile?.desired_unit_price_max ?? '?'}万円</span>
          )}
          {e.profile?.available_from && <span>📅 {fmtDate(e.profile.available_from)}〜</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {e.skills.slice(0, 5).map((s, i) => (
            <span key={s.skill_id ?? i}
              className={`text-xs px-2 py-0.5 rounded-full ${SKILL_CATEGORY_COLOR[s.category ?? 'other'] ?? SKILL_CATEGORY_COLOR.other}`}>
              {s.skill_name}
              {s.experience_years > 0 && <span className="ml-1 opacity-70">{s.experience_years}年</span>}
            </span>
          ))}
          {e.skills.length > 5 && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">+{e.skills.length - 5}</span>}
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
