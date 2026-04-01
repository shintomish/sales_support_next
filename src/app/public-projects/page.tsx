'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
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
const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : null;
const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function PublicProjectsPage() {
  const router = useRouter();
  const [projects, setProjects]   = useState<PublicProject[]>([]);
  const [meta, setMeta]           = useState<Meta>({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [workStyle, setWorkStyle] = useState('');
  const [priceFilter, setPriceFilter] = useState('');
  const [page, setPage]           = useState(1);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/public-projects', {
        params: {
          search: search || undefined,
          work_style: workStyle || undefined,
          unit_price_min: priceFilter || undefined,
          page,
          per_page: 20,
        },
      });
      setProjects(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [search, workStyle, priceFilter, page, router]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const toggleFavorite = async (e: React.MouseEvent, project: PublicProject) => {
    e.stopPropagation();
    try {
      await apiClient.post(`/api/v1/public-projects/${project.id}/favorite`);
      setProjects(prev => prev.map(p =>
        p.id === project.id ? { ...p, is_favorite: !p.is_favorite } : p
      ));
    } catch {}
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">案件マーケット</h1>
          <p className="text-sm text-gray-500 mt-1">全 {meta.total} 件</p>
        </div>
        <Button onClick={() => router.push('/public-projects/create')}>+ 新規掲載</Button>
      </div>

      {/* 検索フィルタ */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="案件名・説明で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchProjects(); } }}
          className="max-w-xs"
        />
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

      {!loading && (
        <>
          {projects.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p>案件が見つかりません</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {projects.map(p => (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/public-projects/${p.id}`)}
                >
                  <CardContent className="p-5">
                    {/* タイトル行 */}
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
                      <button
                        onClick={e => toggleFavorite(e, p)}
                        className="ml-3 text-xl flex-shrink-0 hover:scale-110 transition-transform"
                      >
                        {p.is_favorite ? '♥' : '♡'}
                      </button>
                    </div>

                    {/* 単価・勤務形態 */}
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
                      {p.contract_type && (
                        <span className="text-xs text-gray-500">{p.contract_type}</span>
                      )}
                    </div>

                    {/* 開始日・最寄駅 */}
                    <div className="flex gap-4 text-xs text-gray-500 mb-3">
                      {p.start_date && <span>📅 {fmtDate(p.start_date)}〜</span>}
                      {p.nearest_station && <span>🚉 {p.nearest_station}</span>}
                      {p.remote_frequency && <span>🏠 {p.remote_frequency}</span>}
                    </div>

                    {/* スキルバッジ */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.required_skills.slice(0, 4).map(s => (
                        <span
                          key={s.skill_id}
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            s.is_required
                              ? (SKILL_COLOR[s.category ?? 'other'] ?? SKILL_COLOR.other)
                              : 'bg-gray-50 text-gray-400 border border-gray-200'
                          }`}
                        >
                          {s.skill_name}
                          {!s.is_required && <span className="ml-1 text-gray-400">(歓迎)</span>}
                        </span>
                      ))}
                      {p.required_skills.length > 4 && (
                        <span className="text-xs text-gray-400">+{p.required_skills.length - 4}</span>
                      )}
                    </div>

                    {/* フッター */}
                    <div className="flex gap-4 text-xs text-gray-400 border-t border-gray-50 pt-2">
                      <span>👁 {p.views_count}</span>
                      <span>📝 応募 {p.applications_count}件</span>
                      {p.expires_at && <span>⏰ {fmtDate(p.expires_at)}まで</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {meta.last_page > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
              <span className="text-sm text-gray-500">{page} / {meta.last_page}</span>
              <Button variant="outline" disabled={page >= meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
