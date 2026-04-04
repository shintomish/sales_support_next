'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
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

const WORK_STYLE_LABEL: Record<string, string> = {
  remote: 'フルリモート', office: '出社', hybrid: 'ハイブリッド',
};
const AVAILABILITY_BADGE: Record<string, { label: string; cls: string }> = {
  available: { label: '空き',    cls: 'bg-green-100 text-green-700' },
  working:   { label: '稼働中',  cls: 'bg-orange-100 text-orange-700' },
  scheduled: { label: '◯月予定',cls: 'bg-blue-100 text-blue-700' },
};
const SKILL_CATEGORY_COLOR: Record<string, string> = {
  language:       'bg-blue-100 text-blue-700',
  framework:      'bg-purple-100 text-purple-700',
  database:       'bg-green-100 text-green-700',
  infrastructure: 'bg-orange-100 text-orange-700',
  other:          'bg-gray-100 text-gray-600',
};
const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

export default function EngineersPage() {
  const router = useRouter();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [meta, setMeta]           = useState<Meta>({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [workStyle, setWorkStyle] = useState('');
  const [page, setPage]           = useState(1);

  const fetchEngineers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/engineers', {
        params: { search: search || undefined, work_style: workStyle || undefined, page, per_page: 20 },
      });
      setEngineers(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [search, workStyle, page, router]);

  useEffect(() => { fetchEngineers(); }, [fetchEngineers]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchEngineers(); };

  const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">技術者管理</h1>
          <p className="text-sm text-gray-500 mt-1">全 {meta.total} 名</p>
        </div>
        <Button onClick={() => router.push('/engineers/create')}>+ 新規登録</Button>
      </div>

      {/* 検索フィルタ */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <Input
          placeholder="氏名・所属で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select value={workStyle} onChange={e => { setWorkStyle(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">勤務形態：すべて</option>
          <option value="remote">フルリモート</option>
          <option value="hybrid">ハイブリッド</option>
          <option value="office">出社</option>
        </select>
        <Button type="submit" variant="outline">検索</Button>
      </form>

      {/* ローディング */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 一覧 */}
      {!loading && (
        <>
          {engineers.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🧑‍💻</p>
              <p>技術者が見つかりません</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {engineers.map(e => (
                <Card
                  key={e.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/engineers/${e.id}`)}
                >
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

                    {e.affiliation && (
                      <p className="text-xs text-gray-500 mb-2">🏢 {e.affiliation}</p>
                    )}

                    <div className="flex gap-4 text-xs text-gray-600 mb-3">
                      {(e.profile?.desired_unit_price_min || e.profile?.desired_unit_price_max) && (
                        <span>💰 {e.profile.desired_unit_price_min ?? '?'}〜{e.profile.desired_unit_price_max ?? '?'}万円</span>
                      )}
                      {e.profile?.available_from && (
                        <span>📅 {fmtDate(e.profile.available_from)}〜</span>
                      )}
                    </div>

                    {/* スキルバッジ */}
                    <div className="flex flex-wrap gap-1">
                      {e.skills.slice(0, 5).map(s => (
                        <span
                          key={s.skill_id}
                          className={`text-xs px-2 py-0.5 rounded-full ${SKILL_CATEGORY_COLOR[s.category ?? 'other'] ?? SKILL_CATEGORY_COLOR.other}`}
                        >
                          {s.skill_name}
                          {s.experience_years > 0 && <span className="ml-1 opacity-70">{s.experience_years}年</span>}
                        </span>
                      ))}
                      {e.skills.length > 5 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">+{e.skills.length - 5}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ページネーション */}
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
