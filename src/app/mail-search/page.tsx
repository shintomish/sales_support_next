'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

type Verdict = { verdict: string; reason: string };

function ResultCard({ r, verdict, judging, onJudge, isFav, onToggleFav }: {
  r: Row; verdict: Verdict | null; judging: boolean; onJudge: () => void; isFav: boolean; onToggleFav: () => void;
}) {
  const matched = new Set(r.matched_skills.map(s => s.toLowerCase()));
  const vColor = (vd: string) => vd === '◯' ? 'text-green-700 bg-green-100' : vd === '×' ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100';
  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:bg-blue-50/40 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${badgeColor(r.source)}`}>{r.source_label}</span>
          <span className="font-semibold text-gray-900 truncate" title={r.title}>{r.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-sm font-semibold tabular-nums text-gray-800">{priceText(r.unit_price_min, r.unit_price_max)}</span>
          <button onClick={onToggleFav} title={isFav ? 'お気に入り解除' : 'お気に入りに追加'}
            className={`text-base leading-none ${isFav ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}>
            {isFav ? '★' : '☆'}
          </button>
        </div>
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
        <button onClick={onJudge} disabled={judging}
          className="text-xs px-2 py-0.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50">
          {judging ? 'AI判定中…' : verdict ? '🤖 再判定' : '🤖 AI判定'}
        </button>
        <Link href={r.detail_url} className="text-xs text-blue-600 hover:underline">詳細・提案 →</Link>
      </div>
    </div>
  );
}

function ResultColumn({ title, kind, res, loading, page, setPage, verdicts, judgingKeys, onJudge, onlyOk, favIds, onToggleFav }: {
  title: string; kind: Kind; res: Res | null; loading: boolean; page: number; setPage: (k: Kind, p: number) => void;
  verdicts: Record<string, Verdict>; judgingKeys: Set<string>; onJudge: (r: Row) => void; onlyOk: boolean;
  favIds: Set<string>; onToggleFav: (source: string, id: number) => void;
}) {
  const rows = (res?.data ?? []).filter(r => !onlyOk || verdicts[`${r.source}:${r.id}`]?.verdict === '◯');
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700">{title}</h2>
        <span className="text-xs text-gray-400">{res ? (onlyOk ? `${rows.length} / ${res.total} 件` : `${res.total} 件`) : ''}</span>
      </div>
      <div className="flex-1 min-h-[70vh] space-y-2 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-gray-400 py-6 text-center">検索中...</p>
        ) : !res || rows.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">{onlyOk && res && res.data.length > 0 ? '◯判定の候補はありません' : '該当なし'}</p>
        ) : rows.map(r => {
          const k = `${r.source}:${r.id}`;
          return (
            <ResultCard key={`${r.source}-${r.id}`} r={r}
              verdict={verdicts[k] ?? null} judging={judgingKeys.has(k)} onJudge={() => onJudge(r)}
              isFav={favIds.has(k)} onToggleFav={() => onToggleFav(r.source, r.id)} />
          );
        })}
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
  const [skillMode, setSkillMode] = useState<'or' | 'and'>('or');  // スキル複数語の結合: OR(いずれか)/AND(すべて)
  const [keyword, setKeyword]   = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sort, setSort]         = useState<Sort>('price_asc');
  const [target, setTarget]     = useState<Target>('both');
  const [category, setCategory] = useState<Category>('all');
  const [nlText, setNlText]     = useState('');     // 自然文検索（AI解釈）
  const [parsing, setParsing]   = useState(false);
  const [favIds, setFavIds]     = useState<Set<string>>(new Set());  // "source:id"
  const [favMode, setFavMode]   = useState(false);  // ★お気に入りのみ表示
  const [verdicts, setVerdicts]       = useState<Record<string, Verdict>>({}); // "source:id" -> 判定
  const [judgingKeys, setJudgingKeys] = useState<Set<string>>(new Set());      // 判定中の "source:id"
  const [bulkJudging, setBulkJudging] = useState(false);
  const [onlyOk, setOnlyOk]           = useState(false);  // ◯のみ表示
  const [autoJudge, setAutoJudge]     = useState(true);   // 検索後に上位を自動AI判定

  const [projectRes, setProjectRes]   = useState<Res | null>(null);
  const [engineerRes, setEngineerRes] = useState<Res | null>(null);
  const [projectPage, setProjectPage] = useState(1);
  const [engineerPage, setEngineerPage] = useState(1);
  const [loadingP, setLoadingP] = useState(false);
  const [loadingE, setLoadingE] = useState(false);
  const [searched, setSearched] = useState(false);

  // AI判定の「探している条件」を ref で保持（判定実行時に最新値を読む・依存配列の揺れを避ける）
  const queryIntentRef = useRef('');
  const autoJudgeRef   = useRef(autoJudge);
  autoJudgeRef.current = autoJudge;
  const verdictsRef    = useRef<Record<string, Verdict>>({});
  verdictsRef.current  = verdicts;

  // 検索条件を明示的に渡せるようにする（自然文AI解釈の直後など state 反映待ちを避けるため）
  type Crit = { skill: string; keyword: string; priceMin: string; priceMax: string };
  const buildCrit = useCallback((): Crit => ({ skill, keyword, priceMin, priceMax }), [skill, keyword, priceMin, priceMax]);

  // 複数候補を一括AI判定（キャッシュ優先・並列。サーバ側で未判定のみ最大30件/回）。
  const judgeMany = useCallback(async (rows: Row[], refresh = false) => {
    const targets = rows.filter(r => refresh || !verdictsRef.current[`${r.source}:${r.id}`]);
    if (targets.length === 0) return;
    const intent = queryIntentRef.current.trim() || '条件指定なし';
    const items = targets.map(r => ({
      type: r.source, label: r.source_label, id: r.id, title: r.title,
      skills: r.skills.join(','), price: priceText(r.unit_price_min, r.unit_price_max),
      sub: r.sub ?? '', location: r.location ?? '',
    }));
    const keys = targets.map(r => `${r.source}:${r.id}`);
    setJudgingKeys(prev => { const n = new Set(prev); keys.forEach(k => n.add(k)); return n; });
    try {
      const res = await apiClient.post<{ data: { type: string; id: number; verdict: string | null; reason: string | null }[] }>(
        '/api/v1/mail-search/judge-bulk', { query: intent, items, refresh });
      setVerdicts(prev => {
        const n = { ...prev };
        (res.data.data ?? []).forEach(d => { if (d.verdict) n[`${d.type}:${d.id}`] = { verdict: d.verdict, reason: d.reason ?? '' }; });
        return n;
      });
    } catch { /* noop */ }
    finally { setJudgingKeys(prev => { const n = new Set(prev); keys.forEach(k => n.delete(k)); return n; }); }
  }, []);

  const judgeOne = useCallback((r: Row) => judgeMany([r], true), [judgeMany]);

  const fetchKind = useCallback(async (kind: Kind, page: number, crit?: Crit) => {
    const c = crit ?? { skill, keyword, priceMin, priceMax };
    const setLoading = kind === 'project' ? setLoadingP : setLoadingE;
    const setRes = kind === 'project' ? setProjectRes : setEngineerRes;
    setLoading(true);
    try {
      if (favMode) {
        // ★お気に入りのみ: 検索条件は無視してお気に入り一覧を取得
        const res = await apiClient.get<{ data: Row[]; total: number }>(`/api/v1/favorites?kind=${kind}`);
        setRes({ data: res.data.data ?? [], total: res.data.total ?? 0, current_page: 1, last_page: 1 });
        return;
      }
      const params = new URLSearchParams({ kind, sort, category, page: String(page) });
      if (c.skill.trim()) { params.set('skill', c.skill.trim()); params.set('skill_mode', skillMode); }
      if (c.keyword.trim())  params.set('keyword', c.keyword.trim());
      if (c.priceMin.trim()) params.set('price_min', c.priceMin.trim());
      if (c.priceMax.trim()) params.set('price_max', c.priceMax.trim());
      const res = await apiClient.get<Res>(`/api/v1/mail-search?${params}`);
      setRes(res.data);
      // 上位を自動AI判定（条件がある時のみ・キャッシュ優先なので再検索は安価）
      if (autoJudgeRef.current && queryIntentRef.current.trim() !== '') {
        judgeMany((res.data.data ?? []).slice(0, 10));
      }
    } finally { setLoading(false); }
  }, [skill, skillMode, keyword, priceMin, priceMax, sort, category, favMode, judgeMany]);

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

  // お気に入りIDをロード（★表示用）
  const loadFavIds = useCallback(async () => {
    try {
      const res = await apiClient.get<Record<string, number[]>>('/api/v1/favorites/ids');
      const s = new Set<string>();
      Object.entries(res.data || {}).forEach(([type, ids]) => (ids ?? []).forEach(id => s.add(`${type}:${id}`)));
      setFavIds(s);
    } catch { /* noop */ }
  }, []);
  useEffect(() => { loadFavIds(); }, [loadFavIds]);

  const toggleFav = useCallback(async (source: string, id: number) => {
    const key = `${source}:${id}`;
    try {
      const res = await apiClient.post<{ favorited: boolean }>('/api/v1/favorites/toggle', { target_type: source, target_id: id });
      setFavIds(prev => { const n = new Set(prev); if (res.data.favorited) n.add(key); else n.delete(key); return n; });
      if (favMode) runSearch(); // お気に入り表示中に解除したら一覧から除く
    } catch { /* noop */ }
  }, [favMode, runSearch]);

  // 対象・分類・並び替え・お気に入りモードを変更したら自動で再検索（ボタン不要）。
  // テキスト入力(スキル/単価/キーワード/自然文)は従来どおり Enter/ボタンで実行。
  useEffect(() => {
    if (searched || favMode) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, category, sort, favMode, skillMode]);

  // AI判定で使う「探している条件」テキスト（自然文があれば優先）
  const queryIntent = nlText.trim() || [
    skill.trim() ? `スキル:${skill.trim()}` : '',
    (priceMin.trim() || priceMax.trim()) ? `単価:${priceMin || ''}〜${priceMax || ''}万` : '',
    keyword.trim(),
  ].filter(Boolean).join(' ');
  queryIntentRef.current = queryIntent;

  // 表示中の候補をまとめてAI判定（列ごとに送信。1列≤50件、サーバ側は未判定のみ最大30件/回）
  const judgeVisible = useCallback(async () => {
    if (queryIntent.trim() === '') { alert('AI判定には検索条件（スキル/単価/自然文 等）が必要です。'); return; }
    setBulkJudging(true);
    try {
      await Promise.all([
        projectRes?.data?.length ? judgeMany(projectRes.data) : Promise.resolve(),
        engineerRes?.data?.length ? judgeMany(engineerRes.data) : Promise.resolve(),
      ]);
    } finally { setBulkJudging(false); }
  }, [queryIntent, projectRes, engineerRes, judgeMany]);

  return (
    <div className="min-h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">検索マッチング</h1>
        <p className="text-xs text-gray-400 mt-1">スキル・単価で案件/技術者を横断検索（案件メール・技術者メール・登録案件・登録技術者）。スコアで足切りしません</p>
      </div>

      {/* 検索フォーム */}
      <div className="flex-shrink-0 bg-white p-4 rounded-lg border border-gray-200 mb-4">
        {/* 自然文 / メール貼り付け で AI 検索 */}
        <div className="mb-3 pb-3 border-b border-gray-100">
          <label className="block text-xs font-semibold text-gray-700 mb-1">🤖 自然文 / メール貼り付けでAI検索</label>
          <div className="flex items-start gap-2">
            <textarea value={nlText} onChange={e => setNlText(e.target.value)} rows={3}
              placeholder="例: Javaできて即日入れる人、70万くらい ／ または 案件・技術者メールの本文をそのまま貼り付け"
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) parseAndSearch(); }}
              className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <Button variant="outline" onClick={parseAndSearch} disabled={parsing || !nlText.trim()} className="flex-shrink-0">
              {parsing ? 'AI解釈中…' : 'AIで検索'}
            </Button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">メール本文を貼り付けると、AIがスキル・単価等を抽出して検索（Ctrl/⌘+Enterでも実行）。対象で「探す側（案件/技術者）」を選んでください。</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-semibold text-gray-700">スキル（空白区切りで複数）</label>
              <div className="inline-flex rounded-md border border-gray-200 overflow-hidden" role="group" aria-label="スキル複数語の結合方式">
                <button type="button" onClick={() => setSkillMode('or')}
                  aria-pressed={skillMode === 'or'}
                  className={`px-2 py-0.5 text-[11px] font-medium ${skillMode === 'or' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  OR検索
                </button>
                <button type="button" onClick={() => setSkillMode('and')}
                  aria-pressed={skillMode === 'and'}
                  className={`px-2 py-0.5 text-[11px] font-medium border-l border-gray-200 ${skillMode === 'and' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  AND検索
                </button>
              </div>
              <span className="text-[10px] text-gray-400">{skillMode === 'or' ? 'いずれかを含む' : 'すべて含む'}</span>
            </div>
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
          <label className="flex items-center gap-1.5 text-sm text-gray-700 ml-auto cursor-pointer">
            <input type="checkbox" checked={favMode} onChange={e => setFavMode(e.target.checked)} />
            ★お気に入りのみ
          </label>
          <Button onClick={runSearch}>🔎 検索</Button>
        </div>
      </div>

      {/* 結果 */}
      {searched ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* AIツールバー */}
          <div className="flex-shrink-0 flex flex-wrap items-center gap-3 mb-2 text-sm">
            <button onClick={judgeVisible} disabled={bulkJudging || favMode}
              className="px-3 py-1 rounded-md border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50 font-medium">
              {bulkJudging ? '🤖 一括判定中…' : '🤖 表示中をAI判定'}
            </button>
            <label className="flex items-center gap-1.5 text-gray-700 cursor-pointer">
              <input type="checkbox" checked={onlyOk} onChange={e => setOnlyOk(e.target.checked)} />
              ◯のみ表示
            </label>
            <label className="flex items-center gap-1.5 text-gray-700 cursor-pointer">
              <input type="checkbox" checked={autoJudge} onChange={e => setAutoJudge(e.target.checked)} />
              検索後に上位10件を自動判定
            </label>
            <span className="text-xs text-gray-400">◯=よく合う / △=一部・情報不足 / ×=合わない（AI・参考）</span>
          </div>
          <div className="flex-1 min-h-0 flex gap-4">
            {target !== 'engineer' && (
              <ResultColumn title="案件" kind="project" res={projectRes} loading={loadingP} page={projectPage} setPage={setPage}
                verdicts={verdicts} judgingKeys={judgingKeys} onJudge={judgeOne} onlyOk={onlyOk} favIds={favIds} onToggleFav={toggleFav} />
            )}
            {target !== 'project' && (
              <ResultColumn title="技術者" kind="engineer" res={engineerRes} loading={loadingE} page={engineerPage} setPage={setPage}
                verdicts={verdicts} judgingKeys={judgingKeys} onJudge={judgeOne} onlyOk={onlyOk} favIds={favIds} onToggleFav={toggleFav} />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">条件を入力して「検索」を押してください</div>
      )}
    </div>
  );
}
