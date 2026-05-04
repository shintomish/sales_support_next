'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ApiError } from '@/lib/error-helpers';

// engineer-mails の日本語 affiliation_type → engineers の英語値
const AFFILIATION_JP_TO_EN: Record<string, string> = {
  '自社正社員': 'self',
  '一社先正社員': 'first_sub',
  'BP': 'bp',
  'BP要員': 'bp_member',
  '契約社員': 'contract',
  '個人事業主': 'freelance',
  '入社予定': 'joining',
  '採用予定': 'hiring',
};

const inputCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'text-xs text-gray-500 mb-1 block';

interface SkillItem { skill_id: number; skill_name: string; category: string | null; experience_years: string; proficiency_level: string; }
interface SkillOption { id: number; name: string; category: string | null; }

type Tab = 'basic' | 'skills' | 'profile';

const SKILL_CATEGORY_COLOR: Record<string, string> = {
  language: 'bg-blue-100 text-blue-700', framework: 'bg-purple-100 text-purple-700',
  database: 'bg-green-100 text-green-700', infrastructure: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-300 text-gray-700',
};

export default function EngineerCreatePage() {
  const router     = useRouter();
  const searchParams = useSearchParams();

  // engineer-mails からの引き継ぎ情報
  const fromPath        = searchParams.get('from')             ?? '/engineers';
  const engineerMailId  = searchParams.get('engineer_mail_id') ?? null;
  const initName      = searchParams.get('name')             ?? '';
  const initStation   = searchParams.get('nearest_station')  ?? '';
  const initAvailable = searchParams.get('available_from')   ?? '';
  const initAffJp     = searchParams.get('affiliation_type') ?? '';
  const initAffType   = AFFILIATION_JP_TO_EN[initAffJp] ?? initAffJp;
  const initAffiliation = searchParams.get('affiliation')    ?? '';
  const initEmailAddr   = searchParams.get('email_address')  ?? '';
  const initSkillsRaw   = searchParams.get('skills')         ?? '';

  const [tab, setTab]       = useState<Tab>('basic');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // スキルシートアップロード
  const [parsing, setParsing]           = useState(false);
  const [parseError, setParseError]     = useState('');
  const [resumeFileUrl, setResumeFileUrl]   = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [isDragging, setIsDragging]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 基本情報（engineer-mails からの引き継ぎ値で初期化）
  const [name, setName]                           = useState(initName);
  const [nameKana, setNameKana]                   = useState('');
  const [email, setEmail]                         = useState(initEmailAddr);
  const [phone, setPhone]                         = useState('');
  const [affiliation, setAffiliation]             = useState(initAffiliation);
  const [affiliationContact, setAffiliationContact] = useState('');
  const [affiliationEmail, setAffiliationEmail]     = useState('');
  const [affiliationType, setAffiliationType]     = useState(initAffType);
  const [age, setAge]                             = useState('');
  const [gender, setGender]                       = useState('');
  const [nationality, setNationality]             = useState('');
  const [nearestStation, setNearestStation]       = useState(initStation);

  // スキル
  const [skillQuery, setSkillQuery]         = useState('');
  const [skillOptions, setSkillOptions]     = useState<SkillOption[]>([]);
  const [addedSkills, setAddedSkills]       = useState<SkillItem[]>([]);
  const [skillSearching, setSkillSearching] = useState(false);

  // 希望条件（稼働可能日は日付形式のみセット）
  const [priceMin, setPriceMin]           = useState('');
  const [priceMax, setPriceMax]           = useState('');
  const [availableFrom, setAvailableFrom] = useState(/^\d{4}-\d{2}-\d{2}$/.test(initAvailable) ? initAvailable : '');
  const [workStyle, setWorkStyle]         = useState('');
  const [location, setLocation]           = useState('');
  const [intro, setIntro]                 = useState('');
  const [github, setGithub]               = useState('');
  const [portfolio, setPortfolio]         = useState('');
  const [isPublic, setIsPublic]           = useState(false);

  // スキルシート解析共通処理
  const processSkillSheetFile = async (file: File) => {
    setParsing(true);
    setParseError('');
    setResumeFileName(file.name);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post('/api/v1/engineers/parse-skill-sheet', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { extracted, skills: parsedSkills, file_url } = res.data;

      if (extracted.name)                setName(extracted.name);
      if (extracted.name_kana)           setNameKana(extracted.name_kana);
      if (extracted.email)               setEmail(extracted.email);
      if (extracted.phone)               setPhone(extracted.phone);
      if (extracted.affiliation)         setAffiliation(extracted.affiliation);
      if (extracted.affiliation_contact) setAffiliationContact(extracted.affiliation_contact);
      if (extracted.affiliation_type)    setAffiliationType(extracted.affiliation_type);
      if (extracted.age)                 setAge(String(extracted.age));
      if (extracted.gender)              setGender(extracted.gender);
      if (extracted.nationality)         setNationality(extracted.nationality);
      if (extracted.nearest_station)     setNearestStation(extracted.nearest_station);
      if (extracted.desired_unit_price_min) setPriceMin(String(extracted.desired_unit_price_min));
      if (extracted.desired_unit_price_max) setPriceMax(String(extracted.desired_unit_price_max));
      if (extracted.available_from)      setAvailableFrom(extracted.available_from);
      if (extracted.work_style)          setWorkStyle(extracted.work_style);
      if (extracted.preferred_location)  setLocation(extracted.preferred_location);
      if (extracted.self_introduction)   setIntro(extracted.self_introduction);
      if (parsedSkills?.length > 0) {
        setAddedSkills(parsedSkills.map((s: { skill_id: number; skill_name: string; category: string | null; experience_years: number }) => ({
          skill_id: s.skill_id, skill_name: s.skill_name, category: s.category,
          experience_years: String(s.experience_years ?? 0), proficiency_level: '3',
        })));
      }
      if (file_url) setResumeFileUrl(file_url);
      setTab('basic');
    } catch {
      setParseError('解析に失敗しました。ファイル形式を確認してください。');
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSkillSheetFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processSkillSheetFile(file);
  };

  const searchSkills = useCallback(async (q: string) => {
    if (!q.trim()) { setSkillOptions([]); return; }
    setSkillSearching(true);
    try {
      const res = await apiClient.get('/api/v1/matching/skills', { params: { search: q } });
      setSkillOptions(res.data.data);
    } finally { setSkillSearching(false); }
  }, []);

  // engineer-mails から引き継いだスキルをマウント時に自動追加
  useEffect(() => {
    if (!initSkillsRaw) return;
    const skillNames = initSkillsRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (skillNames.length === 0) return;

    const autoAddSkills = async () => {
      const results: SkillItem[] = [];
      for (const skillName of skillNames) {
        try {
          // 既存スキルを検索（完全一致優先）
          const res = await apiClient.get('/api/v1/matching/skills', { params: { search: skillName } });
          const options: SkillOption[] = res.data.data ?? [];
          const exact = options.find(o => o.name.toLowerCase() === skillName.toLowerCase());
          if (exact) {
            results.push({ skill_id: exact.id, skill_name: exact.name, category: exact.category, experience_years: '0', proficiency_level: '3' });
          } else {
            // 存在しない場合は新規作成
            const created = await apiClient.post('/api/v1/matching/skills', { name: skillName, category: 'other' });
            const newSkill = created.data.data;
            results.push({ skill_id: newSkill.id, skill_name: newSkill.name, category: newSkill.category, experience_years: '0', proficiency_level: '3' });
          }
        } catch {
          // 個別スキルの失敗は無視して続行
        }
      }
      if (results.length > 0) {
        setAddedSkills(results);
      }
    };

    autoAddSkills();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSkill = (opt: SkillOption) => {
    if (addedSkills.some(s => s.skill_id === opt.id)) return;
    setAddedSkills(prev => [...prev, { skill_id: opt.id, skill_name: opt.name, category: opt.category, experience_years: '0', proficiency_level: '3' }]);
    setSkillQuery(''); setSkillOptions([]);
  };

  const addNewSkill = async (skillName: string) => {
    if (!skillName.trim()) return;
    try {
      const res = await apiClient.post('/api/v1/matching/skills', { name: skillName.trim(), category: 'other' });
      addSkill(res.data.data);
    } catch { alert('スキルの追加に失敗しました'); }
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setErrors({ name: '氏名は必須です' }); setTab('basic'); return; }
    setSaving(true); setErrors({});
    try {
      await apiClient.post('/api/v1/engineers', {
        name, name_kana: nameKana || null, email: email || null,
        phone: phone || null, affiliation: affiliation || null,
        affiliation_contact: affiliationContact || null,
        affiliation_email: affiliationEmail || null,
        affiliation_type: affiliationType || null,
        engineer_mail_source_id: engineerMailId ? Number(engineerMailId) : null,
        age: age ? Number(age) : null,
        gender: gender || null,
        nationality: nationality || null,
        nearest_station: nearestStation || null,
        desired_unit_price_min: priceMin ? Number(priceMin) : null,
        desired_unit_price_max: priceMax ? Number(priceMax) : null,
        available_from: availableFrom || null,
        work_style: workStyle || null,
        preferred_location: location || null,
        self_introduction: intro || null,
        github_url: github || null,
        portfolio_url: portfolio || null,
        resume_file_path: resumeFileUrl || null,
        is_public: isPublic,
        skills: addedSkills.map(s => ({
          skill_id: s.skill_id,
          experience_years: Number(s.experience_years),
          proficiency_level: Number(s.proficiency_level),
        })),
      });
      // 技術者メールから遷移した場合、ステータスを「登録済」に自動変更
      if (engineerMailId) {
        try {
          await apiClient.put(`/api/v1/engineer-mails/${engineerMailId}/status`, { status: 'registered' });
        } catch {
          // ステータス更新失敗は無視して登録完了を優先
        }
      }
      router.push(fromPath);
    } catch (err: unknown) {
      if ((err as ApiError).response?.data?.errors) setErrors(((err as ApiError).response?.data?.errors ?? {}) as unknown as Record<string, string>);
      else alert('保存に失敗しました');
    } finally { setSaving(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basic',   label: '👤 基本情報' },
    { key: 'skills',  label: '🔧 スキル' },
    { key: 'profile', label: '📋 希望条件' },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" onClick={() => router.push(fromPath)}>← 戻る</Button>
        <h1 className="text-2xl font-bold text-gray-800">技術者 新規登録</h1>
        {initName && (
          <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
            技術者メールから引き継ぎ
          </span>
        )}
      </div>

      {/* 引き継ぎ情報のメモ */}
      {initSkillsRaw && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
          <span className="font-medium">スキル自動追加済み：</span> {initSkillsRaw}
          <span className="ml-2 text-blue-600">（スキルタブで経験年数・習熟度を確認してください）</span>
        </div>
      )}
      {initAvailable && !/^\d{4}-\d{2}-\d{2}$/.test(initAvailable) && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <span className="font-medium">メール記載の稼働可能日：</span> {initAvailable}
          <span className="ml-2 text-amber-600">（希望条件タブで日付を入力してください）</span>
        </div>
      )}

      {/* スキルシートアップロード（D&D対応） */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mb-6 rounded-lg border-2 border-dashed p-4 transition-colors ${
          isDragging ? 'border-blue-400 bg-blue-100' : 'border-blue-200 bg-blue-50'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800 mb-1">スキルシートから自動入力</p>
            <p className="text-xs text-blue-600">
              PDF・Excel・Word をドラッグ＆ドロップ、またはファイルを選択するとフォームに自動セットされます
            </p>
            {parseError && <p className="text-xs text-red-500 mt-1">{parseError}</p>}
          </div>
          <div className="flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.xlsm,.docx,.doc"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <Button
              type="button"
              variant="outline"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              {parsing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  解析中...
                </span>
              ) : 'ファイルを選択'}
            </Button>
          </div>
        </div>
        {resumeFileUrl && (
          <p className="text-xs text-green-600 mt-2">
            ファイル保存済み ✓ <span className="text-gray-600">{resumeFileName}</span>{' '}
            <a href={resumeFileUrl} target="_blank" rel="noreferrer" className="underline text-yellow-700">確認する</a>
          </p>
        )}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>氏名（イニシャル） <span className="text-red-500">*</span></label>
                  <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="山田 太郎 / Y.T." />
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
                <div>
                  <label className={labelCls}>所属会社メール</label>
                  <input className={inputCls} type="email" value={affiliationEmail} onChange={e => setAffiliationEmail(e.target.value)} placeholder="info@example.co.jp" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>年齢</label>
                  <input className={inputCls} type="number" min="18" max="80" value={age} onChange={e => setAge(e.target.value)} placeholder="35" />
                </div>
                <div>
                  <label className={labelCls}>性別</label>
                  <select className={inputCls} value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">選択</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                    <option value="unanswered">回答しない</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>国籍</label>
                  <input className={inputCls} value={nationality} onChange={e => setNationality(e.target.value)} placeholder="日本" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>最寄駅</label>
                  <input className={inputCls} value={nearestStation} onChange={e => setNearestStation(e.target.value)} placeholder="渋谷駅" />
                </div>
                <div>
                  <label className={labelCls}>所属区分</label>
                  <select className={inputCls} value={affiliationType} onChange={e => setAffiliationType(e.target.value)}>
                    <option value="">選択</option>
                    <option value="self">自社正社員</option>
                    <option value="first_sub">一社先正社員</option>
                    <option value="bp">BP</option>
                    <option value="bp_member">BP要員</option>
                    <option value="contract">契約社員</option>
                    <option value="freelance">個人事業主</option>
                    <option value="joining">入社予定</option>
                    <option value="hiring">採用予定</option>
                  </select>
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
                {(skillOptions.length > 0 || skillQuery.trim()) && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-md">
                    {skillOptions.map(opt => (
                      <button key={opt.id} onClick={() => addSkill(opt)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SKILL_CATEGORY_COLOR[opt.category ?? 'other'] ?? SKILL_CATEGORY_COLOR.other}`}>
                          {opt.category ?? 'other'}
                        </span>
                        {opt.name}
                      </button>
                    ))}
                    {skillQuery.trim() && !skillOptions.some(o => o.name.toLowerCase() === skillQuery.trim().toLowerCase()) && (
                      <button onClick={() => addNewSkill(skillQuery)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 text-green-700 border-t border-gray-100 flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">新規</span>
                        「{skillQuery.trim()}」を新しいスキルとして追加
                      </button>
                    )}
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
                        <input type="number" min="0" max="50" step="0.5"
                          className="w-16 border border-gray-200 rounded px-2 py-1 text-xs"
                          value={s.experience_years}
                          onChange={e => setAddedSkills(prev => prev.map((x, j) => j === i ? { ...x, experience_years: e.target.value } : x))} />
                        <span className="text-xs text-gray-500">年</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">習熟度</label>
                        <select className="border border-gray-200 rounded px-2 py-1 text-xs" value={s.proficiency_level}
                          onChange={e => setAddedSkills(prev => prev.map((x, j) => j === i ? { ...x, proficiency_level: e.target.value } : x))}>
                          <option value="1">1: 入門</option>
                          <option value="2">2: 基礎</option>
                          <option value="3">3: 実務</option>
                          <option value="4">4: 上級</option>
                          <option value="5">5: エキスパート</option>
                        </select>
                      </div>
                      <button onClick={() => setAddedSkills(prev => prev.filter((_, j) => j !== i))} className="ml-auto text-gray-400 hover:text-red-500">✕</button>
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
                    <option value="hybrid">出社、リモートどちらも対応</option>
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
                <textarea className={inputCls + ' h-24 resize-none'} value={intro} onChange={e => setIntro(e.target.value)} placeholder="得意分野・実績など" />
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
                <input id="is_public" type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                <label htmlFor="is_public" className="text-sm text-gray-700">マッチングマーケットに公開する</label>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={() => router.push(fromPath)}>キャンセル</Button>
        <Button onClick={handleSubmit} disabled={saving}>{saving ? '保存中...' : '登録する'}</Button>
      </div>
    </div>
  );
}
