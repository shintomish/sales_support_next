'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const inputCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'text-xs text-gray-500 mb-1 block';

interface SkillItem { skill_id: number; skill_name: string; category: string | null; experience_years: string; proficiency_level: string; }
interface SkillOption { id: number; name: string; category: string | null; }

type Tab = 'basic' | 'skills' | 'profile';

export default function EngineerCreatePage() {
  const router = useRouter();
  const [tab, setTab]     = useState<Tab>('basic');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 基本情報
  const [name, setName]               = useState('');
  const [nameKana, setNameKana]       = useState('');
  const [email, setEmail]             = useState('');
  const [phone, setPhone]             = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [affiliationContact, setAffiliationContact] = useState('');

  // スキル
  const [skillQuery, setSkillQuery]         = useState('');
  const [skillOptions, setSkillOptions]     = useState<SkillOption[]>([]);
  const [addedSkills, setAddedSkills]       = useState<SkillItem[]>([]);
  const [skillSearching, setSkillSearching] = useState(false);

  // 希望条件
  const [priceMin, setPriceMin]     = useState('');
  const [priceMax, setPriceMax]     = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [workStyle, setWorkStyle]   = useState('');
  const [location, setLocation]     = useState('');
  const [intro, setIntro]           = useState('');
  const [github, setGithub]         = useState('');
  const [portfolio, setPortfolio]   = useState('');
  const [isPublic, setIsPublic]     = useState(false);

  const searchSkills = useCallback(async (q: string) => {
    if (!q.trim()) { setSkillOptions([]); return; }
    setSkillSearching(true);
    try {
      const res = await apiClient.get('/api/v1/matching/skills', { params: { search: q } });
      setSkillOptions(res.data.data);
    } finally { setSkillSearching(false); }
  }, []);

  const addSkill = (opt: SkillOption) => {
    if (addedSkills.some(s => s.skill_id === opt.id)) return;
    setAddedSkills(prev => [...prev, {
      skill_id: opt.id, skill_name: opt.name, category: opt.category,
      experience_years: '0', proficiency_level: '3',
    }]);
    setSkillQuery('');
    setSkillOptions([]);
  };

  const updateSkill = (idx: number, field: 'experience_years' | 'proficiency_level', val: string) => {
    setAddedSkills(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const removeSkill = (idx: number) => setAddedSkills(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!name.trim()) { setErrors({ name: '氏名は必須です' }); setTab('basic'); return; }
    setSaving(true);
    setErrors({});
    try {
      await apiClient.post('/api/v1/engineers', {
        name, name_kana: nameKana || null, email: email || null,
        phone: phone || null, affiliation: affiliation || null,
        affiliation_contact: affiliationContact || null,
        desired_unit_price_min: priceMin ? Number(priceMin) : null,
        desired_unit_price_max: priceMax ? Number(priceMax) : null,
        available_from: availableFrom || null,
        work_style: workStyle || null,
        preferred_location: location || null,
        self_introduction: intro || null,
        github_url: github || null,
        portfolio_url: portfolio || null,
        is_public: isPublic,
        skills: addedSkills.map(s => ({
          skill_id: s.skill_id,
          experience_years: Number(s.experience_years),
          proficiency_level: Number(s.proficiency_level),
        })),
      });
      router.push('/engineers');
    } catch (err: any) {
      if (err.response?.data?.errors) setErrors(err.response.data.errors);
      else alert('保存に失敗しました');
    } finally { setSaving(false); }
  };

  const SKILL_CATEGORY_COLOR: Record<string, string> = {
    language: 'bg-blue-100 text-blue-700', framework: 'bg-purple-100 text-purple-700',
    database: 'bg-green-100 text-green-700', infrastructure: 'bg-orange-100 text-orange-700',
    other: 'bg-gray-100 text-gray-600',
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basic',   label: '👤 基本情報' },
    { key: 'skills',  label: '🔧 スキル' },
    { key: 'profile', label: '📋 希望条件' },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" onClick={() => router.push('/engineers')}>← 戻る</Button>
        <h1 className="text-2xl font-bold text-gray-800">技術者 新規登録</h1>
      </div>

      {/* タブ */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t.label}</button>
        ))}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">

          {/* ── 基本情報 ── */}
          {tab === 'basic' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>氏名 <span className="text-red-500">*</span></label>
                  <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="山田 太郎" />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className={labelCls}>氏名カナ</label>
                  <input className={inputCls} value={nameKana} onChange={e => setNameKana(e.target.value)} placeholder="ヤマダ タロウ" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>メールアドレス</label>
                  <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>電話番号</label>
                  <input className={inputCls} type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>所属会社</label>
                  <input className={inputCls} value={affiliation} onChange={e => setAffiliation(e.target.value)} placeholder="株式会社〇〇" />
                </div>
                <div>
                  <label className={labelCls}>所属担当者</label>
                  <input className={inputCls} value={affiliationContact} onChange={e => setAffiliationContact(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ── スキル ── */}
          {tab === 'skills' && (
            <>
              <div className="relative">
                <label className={labelCls}>スキルを検索して追加</label>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    value={skillQuery}
                    onChange={e => { setSkillQuery(e.target.value); searchSkills(e.target.value); }}
                    placeholder="Java, Python, AWS など..."
                  />
                  {skillSearching && <div className="w-5 h-5 mt-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                </div>
                {skillOptions.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-md">
                    {skillOptions.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => addSkill(opt)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                      >
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SKILL_CATEGORY_COLOR[opt.category ?? 'other'] ?? SKILL_CATEGORY_COLOR.other}`}>
                          {opt.category ?? 'other'}
                        </span>
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
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${SKILL_CATEGORY_COLOR[s.category ?? 'other'] ?? SKILL_CATEGORY_COLOR.other}`}>
                        {s.skill_name}
                      </span>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">経験年数</label>
                        <input
                          type="number" min="0" max="50" step="0.5"
                          className="w-16 border border-gray-200 rounded px-2 py-1 text-xs"
                          value={s.experience_years}
                          onChange={e => updateSkill(i, 'experience_years', e.target.value)}
                        />
                        <span className="text-xs text-gray-500">年</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">習熟度</label>
                        <select
                          className="border border-gray-200 rounded px-2 py-1 text-xs"
                          value={s.proficiency_level}
                          onChange={e => updateSkill(i, 'proficiency_level', e.target.value)}
                        >
                          <option value="1">1: 入門</option>
                          <option value="2">2: 基礎</option>
                          <option value="3">3: 実務</option>
                          <option value="4">4: 上級</option>
                          <option value="5">5: エキスパート</option>
                        </select>
                      </div>
                      <button onClick={() => removeSkill(i)} className="ml-auto text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── 希望条件 ── */}
          {tab === 'profile' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>希望単価 下限（万円/月）</label>
                  <input className={inputCls} type="number" min="0" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="60" />
                </div>
                <div>
                  <label className={labelCls}>希望単価 上限（万円/月）</label>
                  <input className={inputCls} type="number" min="0" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="80" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>稼働可能日</label>
                  <input className={inputCls} type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>希望勤務形態</label>
                  <select className={inputCls} value={workStyle} onChange={e => setWorkStyle(e.target.value)}>
                    <option value="">選択してください</option>
                    <option value="remote">フルリモート</option>
                    <option value="hybrid">ハイブリッド</option>
                    <option value="office">出社</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>希望勤務地</label>
                <input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} placeholder="東京都、大阪府など" />
              </div>
              <div>
                <label className={labelCls}>自己PR</label>
                <textarea
                  className={inputCls + ' h-24 resize-none'}
                  value={intro}
                  onChange={e => setIntro(e.target.value)}
                  placeholder="得意分野・実績など"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>GitHub URL</label>
                  <input className={inputCls} type="url" value={github} onChange={e => setGithub(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>ポートフォリオ URL</label>
                  <input className={inputCls} type="url" value={portfolio} onChange={e => setPortfolio(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="is_public"
                  type="checkbox"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="is_public" className="text-sm text-gray-700">マッチングマーケットに公開する</label>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={() => router.push('/engineers')}>キャンセル</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? '保存中...' : '登録する'}
        </Button>
      </div>
    </div>
  );
}
