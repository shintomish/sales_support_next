'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Source = 'project_mail' | 'public_project' | 'engineer_mail' | 'engineer';
interface Row {
  source: Source;
  source_label: string;
  is_registered: boolean;
  id: number;
  title: string;
  sub: string | null;
  skills: string[];
  matched_skills: string[];
  unit_price_min: number | null;
  unit_price_max: number | null;
  location: string | null;
  date: string | null;
  detail_url: string;
}
interface Res { data: Row[]; total: number; current_page: number; last_page: number }

type Kind = 'project' | 'engineer';
type Target = 'both' | 'project' | 'engineer';
type Category = 'all' | 'mail' | 'self' | 'bp';
type Sort = 'price_asc' | 'price_desc' | 'recent' | 'skill_match';

const priceText = (min: number | null, max: number | null) => {
  if (min == null && max == null) return '単価不明';
  if (min != null && max != null) return min === max ? `${max}万` : `${min}〜${max}万`;
  if (max != null) return `〜${max}万`;
  return `${min}万〜`;
};
const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : '');
const badgeColor = (s: Source) =>
  s === 'project_mail' ? 'bg-blue-100 text-blue-700'
  : s === 'public_project' ? 'bg-indigo-100 text-indigo-700'
  : s === 'engineer_mail' ? 'bg-teal-100 text-teal-700'
  : 'bg-emerald-100 text-emerald-700';

function ResultCard({ r, queryIntent }: { r: Row; queryIntent: string }) {
  const matched = new Set(r.matched_skills.map(s => s.toLowerCase()));
  const [verdict, setVerdict] = useState<{ verdict: string; reason: string } | null>(null);
  const [judging, setJudging] = useState(false);
  const judge = async () => {
    setJudging(true);
    try {
      const res = await apiClient.post<{ verdict: string; reason: string }>('/api/v1/mail-search/judge', {
        query: queryIntent || '条件指定なし',
        item: {
          type: r.source_label, title: r.title, skills: r.skills.join(','),
          price: priceText(r.unit_price_min, r.unit_price_max), sub: r.sub ?? '', location: r.location ?? '',
        },
      });
      setVerdict(res.data);
    } catch { setVerdict({ verdict: '△', reason: '判定に失敗しました' }); }
    finally { setJudging(false); }
  };
  const vColor = (vd: string) => vd === '◯' ? 'text-green-700 bg-green-100' : vd === '×' ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100';
  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:bg-blue-50/40 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${badgeColor(r.source)}`}>{r.source_label}</span>
          <span className="font-semibold text-gray-900 truncate" title={r.title}>{r.title}</span>
        </div>
        <span className="text-sm font-semibold tabular-nums text-gray-800 flex-shrink-0">{priceText(r.unit_price_min, r.unit_price_max)}</span>
      </div>
      <div className="mt-0.5 text-xs text-gray-500 flex flex-wrap gap-x-3">
        {r.sub && <span className="truncate">{r.sub}</span>}
        {r.location && <span>📍{r.location}</span>}
        {r.date && <span>{fmtDate(r.date)}</span>}
      </div>
      {r.skills.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {r.skills.slice(0, 20).map((s, i) => {
            const hit = matched.has(s.toLowerCase()) || r.matched_skills.some(m => s.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(s.toLowerCase()));
            return (
              <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded ${hit ? 'bg-amber-200 text-amber-900 font-semibold' : 'bg-gray-100 text-gray-600'}`}>{s}</span>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        {verdict && (
          <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${vColor(verdict.verdict)}`} title={verdict.reason}>
            {verdict.verdict} {verdict.reason}
          </span>
        )}
        <button onClick={judge} disabled={judging}
          className="text-xs px-2 py-0.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50">
          {judging ? 'AI判定中…' : '🤖 AI判定'}
        </button>
        <Link href={r.detail_url} className="text-xs text-blue-600 hover:underline">詳細・提案 →</Link>
      </div>
    </div>
  );
}

function ResultColumn({ title, kind, res, loading, page, setPage, queryIntent }: {
  title: string; kind: Kind; res: Res | null; loading: boolean; page: number; setPage: (k: Kind, p: number) => void; queryIntent: string;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700">{title}</h2>
        <span className="text-xs text-gray-400">{res ? `${res.total} 件` : ''}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-gray-400 py-6 text-center">検索中...</p>
        ) : !res || res.data.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">該当なし</p>
        ) : res.data.map(r => <ResultCard key={`${r.source}-${r.id}`} r={r} queryIntent={queryIntent} />)}
      </div>
      {res && res.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2 text-xs">
          <button disabled={page <= 1} onClick={() => setPage(kind, page - 1)} className="px-2 py-1 border rounded disabled:opacity-40">前</button>
          <span>{res.current_page} / {res.last_page}</span>
          <button disabled={page >= res.last_page} onClick={() => setPage(kind, page + 1)} className="px-2 py-1 border rounded disabled:opacity-40">次</button>
        </div>
      )}
    </div>
  );
}

export default function MailSearchPage() {
  const [skill, setSkill]       = useState('');
  const [keyword, setKeyword]   = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sort, setSort]         = useState<Sort>('price_asc');
  const [target, setTarget]     = useState<Target>('both');
  const [category, setCategory] = useState<Category>('all');
  const [nlText, setNlText]     = useState('');     // 自然文検索（AI解釈）
  const [parsing, setParsing]   = useState(false);

  const [projectRes, setProjectRes]   = useState<Res | null>(null);
  const [engineerRes, setEngineerRes] = useState<Res | null>(null);
  const [projectPage, setProjectPage] = useState(1);
  const [engineerPage, setEngineerPage] = useState(1);
  const [loadingP, setLoadingP] = useState(false);
  const [loadingE, setLoadingE] = useState(false);
  const [searched, setSearched] = useState(false);

  // 検索条件を明示的に渡せるようにする（自然文AI解釈の直後など state 反映待ちを避けるため）
  type Crit = { skill: string; keyword: string; priceMin: string; priceMax: string };
  const buildCrit = useCallback((): Crit => ({ skill, keyword, priceMin, priceMax }), [skill, keyword, priceMin, priceMax]);

  const fetchKind = useCallback(async (kind: Kind, page: number, crit?: Crit) => {
    const c = crit ?? { skill, keyword, priceMin, priceMax };
    const setLoading = kind === 'project' ? setLoadingP : setLoadingE;
    const setRes = kind === 'project' ? setProjectRes : setEngineerRes;
    setLoading(true);
    try {
      const params = new URLSearchParams({ kind, sort, category, page: String(page) });
      if (c.skill.trim())    params.set('skill', c.skill.trim());
      if (c.keyword.trim())  params.set('keyword', c.keyword.trim());
      if (c.priceMin.trim()) params.set('price_min', c.priceMin.trim());
      if (c.priceMax.trim()) params.set('price_max', c.priceMax.trim());
      const res = await apiClient.get<Res>(`/api/v1/mail-search?${params}`);
      setRes(res.data);
    } finally { setLoading(false); }
  }, [skill, keyword, priceMin, priceMax, sort, category]);

  const runWith = useCallback((crit: Crit) => {
    setSearched(true);
    setProjectPage(1); setEngineerPage(1);
    if (target !== 'engineer') fetchKind('project', 1, crit); else setProjectRes(null);
    if (target !== 'project')  fetchKind('engineer', 1, crit); else setEngineerRes(null);
  }, [target, fetchKind]);

  const runSearch = useCallback(() => runWith(buildCrit()), [runWith, buildCrit]);

  // 自然文 → AI解釈 → 各フィールドに反映して検索
  const parseAndSearch = useCallback(async () => {
    if (!nlText.trim()) return;
    setParsing(true);
    try {
      const res = await apiClient.post<{ skills: string[]; price_min: number | null; price_max: number | null; keyword: string | null }>(
        '/api/v1/mail-search/parse', { text: nlText.trim() });
      const d = res.data;
      const crit: Crit = {
        skill: (d.skills ?? []).join(' '),
        keyword: d.keyword ?? '',
        priceMin: d.price_min != null ? String(d.price_min) : '',
        priceMax: d.price_max != null ? String(d.price_max) : '',
      };
      setSkill(crit.skill); setKeyword(crit.keyword); setPriceMin(crit.priceMin); setPriceMax(crit.priceMax);
      runWith(crit);
    } catch {
      alert('AI解釈に失敗しました。条件を直接入力してください。');
    } finally { setParsing(false); }
  }, [nlText, runWith]);

  const setPage = (kind: Kind, p: number) => {
    if (kind === 'project') { setProjectPage(p); fetchKind('project', p); }
    else { setEngineerPage(p); fetchKind('engineer', p); }
  };

  // AI判定で使う「探している条件」テキスト（自然文があれば優先）
  const queryIntent = nlText.trim() || [
    skill.trim() ? `スキル:${skill.trim()}` : '',
    (priceMin.trim() || priceMax.trim()) ? `単価:${priceMin || ''}〜${priceMax || ''}万` : '',
    keyword.trim(),
  ].filter(Boolean).join(' ');

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">検索マッチング</h1>
        <p className="text-xs text-gray-400 mt-1">スキル・単価で案件/技術者を横断検索（案件メール・技術者メール・登録案件・登録技術者）。スコアで足切りしません</p>
      </div>

      {/* 検索フォーム */}
      <div className="flex-shrink-0 bg-white p-4 rounded-lg border border-gray-200 mb-4">
        {/* 自然文検索（AI解釈）*/}
        <div className="flex items-end gap-2 mb-3 pb-3 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-gray-700 mb-1">🤖 自然文で検索（AIが条件に変換）</label>
            <Input value={nlText} onChange={e => setNlText(e.target.value)}
              placeholder="例: Javaできて即日入れる人、70万くらい"
              onKeyDown={e => { if (e.key === 'Enter') parseAndSearch(); }} />
          </div>
          <Button variant="outline" onClick={parseAndSearch} disabled={parsing || !nlText.trim()}>
            {parsing ? 'AI解釈中…' : 'AIで検索'}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1">スキル（空白区切りで複数）</label>
            <Input value={skill} onChange={e => setSkill(e.target.value)} placeholder="例: Java AWS"
              onKeyDown={e => { if (e.key === 'Enter') runSearch(); }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">単価下限(万)</label>
            <Input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="例:50" className="w-24"
              onKeyDown={e => { if (e.key === 'Enter') runSearch(); }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">単価上限(万)</label>
            <Input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="例:80" className="w-24"
              onKeyDown={e => { if (e.key === 'Enter') runSearch(); }} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1">キーワード(任意)</label>
            <Input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="件名・氏名・勤務地 等"
              onKeyDown={e => { if (e.key === 'Enter') runSearch(); }} />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">対象</label>
            <select value={target} onChange={e => setTarget(e.target.value as Target)} className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="both">両方</option>
              <option value="project">案件のみ</option>
              <option value="engineer">技術者のみ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">分類</label>
            <select value={category} onChange={e => setCategory(e.target.value as Category)} className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="all">全て</option>
              <option value="mail">メール</option>
              <option value="self">自社</option>
              <option value="bp">BP</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">並び替え</label>
            <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="price_asc">単価 昇順</option>
              <option value="price_desc">単価 降順</option>
              <option value="recent">新着</option>
              <option value="skill_match">一致スキル数</option>
            </select>
          </div>
          <Button onClick={runSearch} className="ml-auto">🔎 検索</Button>
        </div>
      </div>

      {/* 結果 */}
      {searched ? (
        <div className="flex-1 min-h-0 flex gap-4">
          {target !== 'engineer' && (
            <ResultColumn title="案件" kind="project" res={projectRes} loading={loadingP} page={projectPage} setPage={setPage} queryIntent={queryIntent} />
          )}
          {target !== 'project' && (
            <ResultColumn title="技術者" kind="engineer" res={engineerRes} loading={loadingE} page={engineerPage} setPage={setPage} queryIntent={queryIntent} />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">条件を入力して「検索」を押してください</div>
      )}
    </div>
  );
}
