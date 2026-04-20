'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const inputCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'text-xs text-gray-500 mb-1 block';

interface SkillOption { id: number; name: string; category: string | null; }
interface SkillItem { skill_id: number; skill_name: string; category: string | null; is_required: boolean; min_experience_years: string; }

type Tab = 'basic' | 'contract' | 'skills';

export default function PublicProjectCreatePage() {
  const router  = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab]     = useState<Tab>('basic');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 案件メールからの引き継ぎ
  const fromPath = searchParams.get('from') ?? '/public-projects';
  const [mailBody, setMailBody] = useState('');
  const [mailBodyOpen, setMailBodyOpen] = useState(false);

  useEffect(() => {
    const body = sessionStorage.getItem('project_mail_body');
    if (body) {
      setMailBody(body);
      sessionStorage.removeItem('project_mail_body');
    }
  }, []);

  // 基本情報
  const [title, setTitle]         = useState(searchParams.get('title') ?? '');
  const [description, setDescription] = useState('');
  const [endClient, setEndClient] = useState(searchParams.get('customer_name') ?? '');
  const [startDate, setStartDate] = useState(searchParams.get('start_date') ?? '');
  const [contractType, setContractType] = useState('');
  const [contractMonths, setContractMonths] = useState('');
  const [workStyle, setWorkStyle] = useState('');
  const [remoteFrequency, setRemoteFrequency] = useState('');
  const [workLocation, setWorkLocation] = useState(searchParams.get('work_location') ?? '');
  const [nearestStation, setNearestStation] = useState('');
  const [expYears, setExpYears]   = useState('');
  const [teamSize, setTeamSize]   = useState('');
  const [interviewCount, setInterviewCount] = useState('');
  const [headcount, setHeadcount] = useState('1');

  // 契約条件
  const [priceMin, setPriceMin]   = useState(searchParams.get('unit_price_min') ?? '');
  const [priceMax, setPriceMax]   = useState(searchParams.get('unit_price_max') ?? '');
  const [deductionHours, setDeductionHours] = useState('');
  const [overtimeHours, setOvertimeHours]   = useState('');
  const [settlementUnit, setSettlementUnit] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // スキル
  const [skillQuery, setSkillQuery]       = useState('');
  const [skillOptions, setSkillOptions]   = useState<SkillOption[]>([]);
  const [addedSkills, setAddedSkills]     = useState<SkillItem[]>([]);

  // 案件メールからのスキル引き継ぎ
  useEffect(() => {
    const skillsParam = searchParams.get('required_skills');
    if (!skillsParam) return;
    const skillNames = skillsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (skillNames.length === 0) return;
    (async () => {
      const results: SkillItem[] = [];
      for (const name of skillNames) {
        try {
          const res = await apiClient.get('/api/v1/matching/skills', { params: { search: name } });
          const exact = (res.data.data as SkillOption[]).find(o => o.name.toLowerCase() === name.toLowerCase());
          if (exact) {
            results.push({ skill_id: exact.id, skill_name: exact.name, category: exact.category, is_required: true, min_experience_years: '' });
          }
        } catch { /* skip */ }
      }
      if (results.length > 0) setAddedSkills(results);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const searchSkills = useCallback(async (q: string) => {
    if (!q.trim()) { setSkillOptions([]); return; }
    const res = await apiClient.get('/api/v1/matching/skills', { params: { search: q } });
    setSkillOptions(res.data.data);
  }, []);

  const addSkill = (opt: SkillOption) => {
    if (addedSkills.some(s => s.skill_id === opt.id)) return;
    setAddedSkills(prev => [...prev, { skill_id: opt.id, skill_name: opt.name, category: opt.category, is_required: true, min_experience_years: '' }]);
    setSkillQuery(''); setSkillOptions([]);
  };

  const SKILL_COLOR: Record<string, string> = {
    language: 'bg-blue-100 text-blue-700', framework: 'bg-purple-100 text-purple-700',
    database: 'bg-green-100 text-green-700', infrastructure: 'bg-orange-100 text-orange-700',
    other: 'bg-gray-100 text-gray-600',
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setErrors({ title: '案件タイトルは必須です' }); setTab('basic'); return; }
    setSaving(true); setErrors({});
    try {
      const projectMailId = searchParams.get('project_mail_id');
      await apiClient.post('/api/v1/public-projects', {
        title,
        description:               description || null,
        end_client:                endClient || null,
        project_mail_source_id:    projectMailId ? Number(projectMailId) : null,
        start_date:                startDate || null,
        contract_type:             contractType || null,
        contract_period_months:    contractMonths ? Number(contractMonths) : null,
        work_style:                workStyle || null,
        remote_frequency:          remoteFrequency || null,
        work_location:             workLocation || null,
        nearest_station:           nearestStation || null,
        required_experience_years: expYears ? Number(expYears) : null,
        team_size:                 teamSize ? Number(teamSize) : null,
        interview_count:           interviewCount ? Number(interviewCount) : null,
        headcount:                 headcount ? Number(headcount) : 1,
        unit_price_min:            priceMin ? Number(priceMin) : null,
        unit_price_max:            priceMax ? Number(priceMax) : null,
        deduction_hours:           deductionHours ? Number(deductionHours) : null,
        overtime_hours:            overtimeHours ? Number(overtimeHours) : null,
        settlement_unit_minutes:   settlementUnit ? Number(settlementUnit) : null,
        published_at:              publishedAt || null,
        expires_at:                expiresAt || null,
        skills: addedSkills.map(s => ({
          skill_id: s.skill_id,
          is_required: s.is_required,
          min_experience_years: s.min_experience_years ? Number(s.min_experience_years) : null,
        })),
      });
      router.push(fromPath);
    } catch (err: any) {
      if (err.response?.data?.errors) setErrors(err.response.data.errors);
      else alert('保存に失敗しました');
    } finally { setSaving(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basic',    label: '📋 基本情報' },
    { key: 'contract', label: '💼 契約条件' },
    { key: 'skills',   label: '🔧 必須スキル' },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" onClick={() => router.push('/public-projects')}>← 戻る</Button>
        <h1 className="text-2xl font-bold text-gray-800">案件 新規掲載</h1>
      </div>

      {/* タブ */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t.label}</button>
        ))}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">

          {/* ── 基本情報 ── */}
          {tab === 'basic' && (
            <>
              {mailBody && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMailBodyOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                  >
                    <span>📧 元メール本文</span>
                    <span className="text-gray-400">{mailBodyOpen ? '▲ 閉じる' : '▼ 開く'}</span>
                  </button>
                  {mailBodyOpen && (
                    <div className="px-4 py-3 bg-white max-h-64 overflow-y-auto border-t border-gray-200">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{mailBody}</pre>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className={labelCls}>案件タイトル <span className="text-red-500">*</span></label>
                <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="大規模ECサイト開発 バックエンドエンジニア" />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
              </div>
              <div>
                <label className={labelCls}>案件説明</label>
                <textarea className={inputCls + ' h-24 resize-none'} value={description} onChange={e => setDescription(e.target.value)} placeholder="プロジェクト概要・業務内容・チーム構成など" />
              </div>
              <div>
                <label className={labelCls}>エンドクライアント</label>
                <input className={inputCls} value={endClient} onChange={e => setEndClient(e.target.value)} placeholder="非公開の場合は空欄" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>稼働開始日</label>
                  <input className={inputCls} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>契約形態</label>
                  <select className={inputCls} value={contractType} onChange={e => setContractType(e.target.value)}>
                    <option value="">選択</option>
                    <option value="準委任">準委任</option>
                    <option value="派遣">派遣</option>
                    <option value="請負">請負</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>契約期間（ヶ月）</label>
                  <input className={inputCls} type="number" min="1" value={contractMonths} onChange={e => setContractMonths(e.target.value)} placeholder="長期の場合は空欄" />
                </div>
                <div>
                  <label className={labelCls}>募集人数</label>
                  <input className={inputCls} type="number" min="1" value={headcount} onChange={e => setHeadcount(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>勤務形態</label>
                  <select className={inputCls} value={workStyle} onChange={e => setWorkStyle(e.target.value)}>
                    <option value="">選択</option>
                    <option value="remote">フルリモート</option>
                    <option value="hybrid">ハイブリッド</option>
                    <option value="office">出社</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>リモート頻度</label>
                  <input className={inputCls} value={remoteFrequency} onChange={e => setRemoteFrequency(e.target.value)} placeholder="週4リモート、月1出社など" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>勤務地</label>
                  <input className={inputCls} value={workLocation} onChange={e => setWorkLocation(e.target.value)} placeholder="東京都渋谷区" />
                </div>
                <div>
                  <label className={labelCls}>最寄駅</label>
                  <input className={inputCls} value={nearestStation} onChange={e => setNearestStation(e.target.value)} placeholder="渋谷駅" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>必要経験年数</label>
                  <input className={inputCls} type="number" min="0" value={expYears} onChange={e => setExpYears(e.target.value)} placeholder="3" />
                </div>
                <div>
                  <label className={labelCls}>チーム規模</label>
                  <input className={inputCls} type="number" min="1" value={teamSize} onChange={e => setTeamSize(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>面談回数</label>
                  <input className={inputCls} type="number" min="0" value={interviewCount} onChange={e => setInterviewCount(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ── 契約条件 ── */}
          {tab === 'contract' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>単価 下限（万円/月）</label>
                  <input className={inputCls} type="number" min="0" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="60" />
                </div>
                <div>
                  <label className={labelCls}>単価 上限（万円/月）</label>
                  <input className={inputCls} type="number" min="0" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="75" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>精算下限時間</label>
                  <input className={inputCls} type="number" min="0" step="0.5" value={deductionHours} onChange={e => setDeductionHours(e.target.value)} placeholder="140" />
                </div>
                <div>
                  <label className={labelCls}>精算上限時間</label>
                  <input className={inputCls} type="number" min="0" step="0.5" value={overtimeHours} onChange={e => setOvertimeHours(e.target.value)} placeholder="200" />
                </div>
                <div>
                  <label className={labelCls}>精算単位</label>
                  <select className={inputCls} value={settlementUnit} onChange={e => setSettlementUnit(e.target.value)}>
                    <option value="">選択</option>
                    <option value="15">15分</option>
                    <option value="30">30分</option>
                    <option value="60">60分</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>公開日</label>
                  <input className={inputCls} type="datetime-local" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>募集締切日</label>
                  <input className={inputCls} type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ── 必須スキル ── */}
          {tab === 'skills' && (
            <>
              <div className="relative">
                <label className={labelCls}>スキルを検索して追加</label>
                <input
                  className={inputCls}
                  value={skillQuery}
                  onChange={e => { setSkillQuery(e.target.value); searchSkills(e.target.value); }}
                  placeholder="Java, Python, AWS など..."
                />
                {skillOptions.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-md">
                    {skillOptions.map(opt => (
                      <button key={opt.id} onClick={() => addSkill(opt)} className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SKILL_COLOR[opt.category ?? 'other'] ?? SKILL_COLOR.other}`}>{opt.category ?? 'other'}</span>
                        {opt.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {addedSkills.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">スキルを追加してください</p>
              ) : (
                <div className="space-y-2">
                  {addedSkills.map((s, i) => (
                    <div key={s.skill_id ?? i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${SKILL_COLOR[s.category ?? 'other'] ?? SKILL_COLOR.other}`}>
                        {s.skill_name}
                      </span>
                      <button
                        onClick={() => setAddedSkills(prev => prev.map((x, j) => j === i ? { ...x, is_required: !x.is_required } : x))}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          s.is_required
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}
                      >
                        {s.is_required ? '必須' : '歓迎'}
                      </button>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">最低経験</label>
                        <input
                          type="number" min="0" max="20" step="0.5"
                          className="w-14 border border-gray-200 rounded px-2 py-1 text-xs"
                          value={s.min_experience_years}
                          onChange={e => setAddedSkills(prev => prev.map((x, j) => j === i ? { ...x, min_experience_years: e.target.value } : x))}
                          placeholder="年"
                        />
                        <span className="text-xs text-gray-500">年</span>
                      </div>
                      <button onClick={() => setAddedSkills(prev => prev.filter((_, j) => j !== i))} className="ml-auto text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={() => router.push('/public-projects')}>キャンセル</Button>
        <Button onClick={handleSubmit} disabled={saving}>{saving ? '保存中...' : '掲載する'}</Button>
      </div>
    </div>
  );
}
