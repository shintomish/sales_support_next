'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApiError } from '@/lib/error-helpers';

const inputCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'text-xs text-gray-500 mb-1 block';
const Em = () => <span className="text-gray-300 text-xs">—</span>;
const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : null;

const WORK_STYLE_LABEL: Record<string, string> = { remote: 'フルリモート', office: '出社', hybrid: '出社、リモートどちらも対応' };
const AVAILABILITY_LABEL: Record<string, { label: string; cls: string }> = {
  available:  { label: '空き',     cls: 'bg-green-100 text-green-700' },
  working:    { label: '稼働中',   cls: 'bg-orange-100 text-orange-700' },
  scheduled:  { label: '◯月予定', cls: 'bg-blue-100 text-blue-700' },
};
const AFFILIATION_TYPE_LABEL: Record<string, string> = {
  self: '自社正社員', first_sub: '一社先正社員', bp: 'BP', bp_member: 'BP要員',
  contract: '契約社員', freelance: '個人事業主', joining: '入社予定', hiring: '採用予定',
};
const SKILL_COLOR: Record<string, string> = {
  language: 'bg-blue-100 text-blue-700', framework: 'bg-purple-100 text-purple-700',
  database: 'bg-green-100 text-green-700', infrastructure: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-300 text-gray-700',
};

const GENDER_LABEL: Record<string, string> = {
  male: '男性', female: '女性', other: 'その他', unanswered: '回答しない',
};

interface Engineer {
  id: number; name: string; name_kana: string | null; email: string | null; phone: string | null;
  affiliation: string | null; affiliation_contact: string | null; affiliation_email: string | null;
  age: number | null; gender: string | null; nationality: string | null;
  nearest_station: string | null; affiliation_type: string | null;
  profile: {
    desired_unit_price_min: number | null; desired_unit_price_max: number | null;
    available_from: string | null; availability_status: string | null;
    current_project: string | null; current_customer: string | null; past_client_count: number | null;
    work_style: string | null; preferred_location: string | null;
    self_introduction: string | null; github_url: string | null; portfolio_url: string | null;
    resume_file_path: string | null; is_public: boolean;
  } | null;
  skills: { skill_id: number; skill_name: string; category: string | null; experience_years: number; proficiency_level: number; }[];
}

interface RecommendedProject {
  project_id: number; project_title: string;
  unit_price_min: number | null; unit_price_max: number | null;
  work_style: string | null; start_date: string | null;
  score: number; skill_match_score: number; price_match_score: number;
  location_match_score: number; availability_match_score: number;
}

interface SkillOption { id: number; name: string; category: string | null; }
interface SkillItem { skill_id: number; skill_name: string; category: string | null; experience_years: string; proficiency_level: string; }

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-10 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded h-1.5">
        <div className={`h-1.5 rounded ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-7 text-right">{Math.round(score)}</span>
    </div>
  );
}

export default function EngineerDetailPage() {
  const { id } = useParams();
  const router  = useRouter();
  const [engineer, setEngineer]   = useState<Engineer | null>(null);
  const [projects, setProjects]   = useState<RecommendedProject[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [copied, setCopied]       = useState(false);

  // 編集フォームステート
  const [name, setName]             = useState('');
  const [nameKana, setNameKana]     = useState('');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [affiliationContact, setAffiliationContact] = useState('');
  const [affiliationEmail, setAffiliationEmail]     = useState('');
  const [priceMin, setPriceMin]     = useState('');
  const [priceMax, setPriceMax]     = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [workStyle, setWorkStyle]   = useState('');
  const [location, setLocation]     = useState('');
  const [intro, setIntro]           = useState('');
  const [github, setGithub]         = useState('');
  const [portfolio, setPortfolio]   = useState('');
  const [isPublic, setIsPublic]     = useState(false);
  const [age, setAge]                           = useState('');
  const [gender, setGender]                     = useState('');
  const [nationality, setNationality]           = useState('');
  const [nearestStation, setNearestStation]     = useState('');
  const [affiliationType, setAffiliationType]   = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [currentProject, setCurrentProject] = useState('');
  const [currentCustomer, setCurrentCustomer] = useState('');
  const [pastClientCount, setPastClientCount] = useState('');
  const [addedSkills, setAddedSkills] = useState<SkillItem[]>([]);
  const [skillQuery, setSkillQuery] = useState('');
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);

  // スキルシートアップロード
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [resumeFileUrl, setResumeFileUrl] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processSkillSheetFile(file);
  };

  const fetchEngineer = useCallback(async () => {
    setLoading(true);
    try {
      const [engRes, projRes] = await Promise.all([
        apiClient.get(`/api/v1/engineers/${id}`),
        apiClient.get(`/api/v1/matching/engineers/${id}/projects`).catch(() => ({ data: { data: [] } })),
      ]);
      const e = engRes.data.data;
      setEngineer(e);
      setProjects(projRes.data.data);

      // 編集フォームへ初期値セット
      setName(e.name ?? '');
      setNameKana(e.name_kana ?? '');
      setEmail(e.email ?? '');
      setPhone(e.phone ?? '');
      setAffiliation(e.affiliation ?? '');
      setAffiliationContact(e.affiliation_contact ?? '');
      setAffiliationEmail(e.affiliation_email ?? '');
      setAge(e.age?.toString() ?? '');
      setGender(e.gender ?? '');
      setNationality(e.nationality ?? '');
      setNearestStation(e.nearest_station ?? '');
      setAffiliationType(e.affiliation_type ?? '');
      setAvailabilityStatus(e.profile?.availability_status ?? 'available');
      setCurrentProject(e.profile?.current_project ?? '');
      setCurrentCustomer(e.profile?.current_customer ?? '');
      setPastClientCount(e.profile?.past_client_count?.toString() ?? '');
      setPriceMin(e.profile?.desired_unit_price_min?.toString() ?? '');
      setPriceMax(e.profile?.desired_unit_price_max?.toString() ?? '');
      setAvailableFrom(e.profile?.available_from ?? '');
      setWorkStyle(e.profile?.work_style ?? '');
      setLocation(e.profile?.preferred_location ?? '');
      setIntro(e.profile?.self_introduction ?? '');
      setGithub(e.profile?.github_url ?? '');
      setPortfolio(e.profile?.portfolio_url ?? '');
      setIsPublic(e.profile?.is_public ?? false);
      setAddedSkills(e.skills.map((s: any) => ({
        skill_id: s.skill_id, skill_name: s.skill_name, category: s.category,
        experience_years: s.experience_years?.toString() ?? '0',
        proficiency_level: s.proficiency_level?.toString() ?? '3',
      })));
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else if ((err as ApiError).response?.status === 404) router.push('/engineers');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchEngineer(); }, [fetchEngineer]);

  const searchSkills = async (q: string) => {
    if (!q.trim()) { setSkillOptions([]); return; }
    const res = await apiClient.get('/api/v1/matching/skills', { params: { search: q } });
    setSkillOptions(res.data.data);
  };

  const addSkill = (opt: SkillOption) => {
    if (addedSkills.some(s => s.skill_id === opt.id)) return;
    setAddedSkills(prev => [...prev, { skill_id: opt.id, skill_name: opt.name, category: opt.category, experience_years: '0', proficiency_level: '3' }]);
    setSkillQuery(''); setSkillOptions([]);
  };

  const addNewSkill = async (name: string) => {
    if (!name.trim()) return;
    try {
      const res = await apiClient.post('/api/v1/matching/skills', { name: name.trim(), category: 'other' });
      addSkill(res.data.data);
    } catch {
      alert('スキルの追加に失敗しました');
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) { setErrors({ name: '氏名は必須です' }); return; }
    setSaving(true); setErrors({});
    try {
      await apiClient.put(`/api/v1/engineers/${id}`, {
        name, name_kana: nameKana || null, email: email || null,
        phone: phone || null, affiliation: affiliation || null,
        affiliation_contact: affiliationContact || null,
        affiliation_email: affiliationEmail || null,
        age: age ? Number(age) : null,
        gender: gender || null,
        nationality: nationality || null,
        nearest_station: nearestStation || null,
        affiliation_type: affiliationType || null,
        availability_status: availabilityStatus || 'available',
        current_project: currentProject || null,
        current_customer: currentCustomer || null,
        past_client_count: pastClientCount ? Number(pastClientCount) : null,
        desired_unit_price_min: priceMin ? Number(priceMin) : null,
        desired_unit_price_max: priceMax ? Number(priceMax) : null,
        available_from: availableFrom || null, work_style: workStyle || null,
        preferred_location: location || null, self_introduction: intro || null,
        github_url: github || null, portfolio_url: portfolio || null,
        resume_file_path: resumeFileUrl || engineer?.profile?.resume_file_path || null,
        is_public: isPublic,
        skills: addedSkills.map(s => ({
          skill_id: s.skill_id, experience_years: Number(s.experience_years),
          proficiency_level: Number(s.proficiency_level),
        })),
      });
      setEditing(false);
      fetchEngineer();
    } catch (err: unknown) {
      if ((err as ApiError).response?.data?.errors) setErrors(((err as ApiError).response?.data?.errors ?? {}) as unknown as Record<string, string>);
      else alert('更新に失敗しました');
    } finally { setSaving(false); }
  };

  const copyEngineerText = () => {
    if (!engineer) return;
    const p = engineer.profile;
    const lines: string[] = [];
    lines.push(`【技術者情報】`);
    lines.push(`氏名: ${engineer.name}${engineer.name_kana ? ` (${engineer.name_kana})` : ''}`);
    if (engineer.email)               lines.push(`メール: ${engineer.email}`);
    if (engineer.phone)               lines.push(`電話: ${engineer.phone}`);
    if (engineer.affiliation)         lines.push(`所属: ${engineer.affiliation}`);
    if (engineer.affiliation_contact) lines.push(`所属担当者: ${engineer.affiliation_contact}`);
    if (engineer.affiliation_type)    lines.push(`所属区分: ${AFFILIATION_TYPE_LABEL[engineer.affiliation_type] ?? engineer.affiliation_type}`);
    if (engineer.age)                 lines.push(`年齢: ${engineer.age}歳`);
    if (engineer.gender)              lines.push(`性別: ${GENDER_LABEL[engineer.gender] ?? engineer.gender}`);
    if (engineer.nationality)         lines.push(`国籍: ${engineer.nationality}`);
    if (engineer.nearest_station)     lines.push(`最寄駅: ${engineer.nearest_station}`);
    if (p?.availability_status)       lines.push(`稼働状況: ${AVAILABILITY_LABEL[p.availability_status]?.label ?? p.availability_status}`);
    if (p?.available_from)            lines.push(`稼働可能日: ${fmtDate(p.available_from)}`);
    if (p?.desired_unit_price_min || p?.desired_unit_price_max)
                                      lines.push(`希望単価: ${p?.desired_unit_price_min ?? '?'}〜${p?.desired_unit_price_max ?? '?'}万円/月`);
    if (p?.work_style)                lines.push(`勤務形態: ${WORK_STYLE_LABEL[p.work_style] ?? p.work_style}`);
    if (p?.preferred_location)        lines.push(`希望勤務地: ${p.preferred_location}`);
    if (engineer.skills.length > 0) {
      const skillText = engineer.skills
        .map(s => `${s.skill_name}${s.experience_years > 0 ? `(${s.experience_years}年)` : ''}`)
        .join('、');
      lines.push(`スキル: ${skillText}`);
    }
    if (p?.self_introduction)         lines.push(`\n自己PR:\n${p.self_introduction}`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirm('この技術者を削除しますか？')) return;
    await apiClient.delete(`/api/v1/engineers/${id}`);
    router.push('/engineers');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!engineer) return null;

  const p = engineer.profile;

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push('/engineers')}>← 一覧</Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{engineer.name}</h1>
            {engineer.name_kana && <p className="text-sm text-gray-400">{engineer.name_kana}</p>}
          </div>
          {p?.is_public
            ? <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">公開中</span>
            : <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">非公開</span>
          }
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="outline" onClick={copyEngineerText}
              style={{ background: copied ? '#16a34a' : '', color: copied ? '#fff' : '', borderColor: copied ? '#16a34a' : '', transition: 'all 0.2s' }}>
              {copied ? '✓ コピーしました' : '📋 クリップボードにコピー'}
            </Button>
          )}
          {!editing && <Button onClick={() => setEditing(true)}>✏️ 編集</Button>}
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleDelete}>削除</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── 左：詳細 / 編集 ── */}
        <div className="lg:col-span-2 space-y-4">
          {!editing ? (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">👤 基本情報</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-gray-400">メール</p><p>{engineer.email ?? <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">電話</p><p>{engineer.phone ?? <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">所属</p><p>{engineer.affiliation ?? <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">所属担当者</p><p>{engineer.affiliation_contact ?? <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">所属会社メール</p><p>{engineer.affiliation_email ?? <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">年齢</p><p>{engineer.age ? `${engineer.age}歳` : <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">性別</p><p>{engineer.gender ? (GENDER_LABEL[engineer.gender] ?? engineer.gender) : <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">国籍</p><p>{engineer.nationality ?? <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">最寄駅</p><p>{engineer.nearest_station ?? <Em />}</p></div>
                  <div>
                    <p className="text-xs text-gray-400">所属区分</p>
                    <p>{engineer.affiliation_type ? AFFILIATION_TYPE_LABEL[engineer.affiliation_type] ?? engineer.affiliation_type : <Em />}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">稼働状況</p>
                    {engineer.profile?.availability_status
                      ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AVAILABILITY_LABEL[engineer.profile.availability_status]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                          {AVAILABILITY_LABEL[engineer.profile.availability_status]?.label ?? engineer.profile.availability_status}
                        </span>
                      : <Em />}
                  </div>
                  <div><p className="text-xs text-gray-400">案件名</p><p>{engineer.profile?.current_project ?? <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">顧客</p><p>{engineer.profile?.current_customer ?? <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">稼働実績社数</p><p>{engineer.profile?.past_client_count != null ? `${engineer.profile.past_client_count}社` : <Em />}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">🔧 スキル</CardTitle></CardHeader>
                <CardContent>
                  {engineer.skills.length === 0 ? (
                    <p className="text-sm text-gray-400">未登録</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {engineer.skills.map((s, i) => (
                        <span key={s.skill_id ?? i} className={`text-xs px-2 py-1 rounded-full ${SKILL_COLOR[s.category ?? 'other'] ?? SKILL_COLOR.other}`}>
                          {s.skill_name} {s.experience_years > 0 && `(${s.experience_years}年)`}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">📋 希望条件</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-gray-400">希望単価</p><p>{p?.desired_unit_price_min ?? '?'}〜{p?.desired_unit_price_max ?? '?'}万円/月</p></div>
                  <div><p className="text-xs text-gray-400">稼働可能日</p><p>{fmtDate(p?.available_from ?? null) ?? <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">勤務形態</p><p>{p?.work_style ? WORK_STYLE_LABEL[p.work_style] : <Em />}</p></div>
                  <div><p className="text-xs text-gray-400">希望勤務地</p><p>{p?.preferred_location ?? <Em />}</p></div>
                  {p?.self_introduction && (
                    <div className="col-span-2"><p className="text-xs text-gray-400">自己PR</p><p className="whitespace-pre-wrap">{p.self_introduction}</p></div>
                  )}
                  {p?.github_url && (
                    <div><p className="text-xs text-gray-400">GitHub</p><a href={p.github_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs">{p.github_url}</a></div>
                  )}
                  {p?.portfolio_url && (
                    <div><p className="text-xs text-gray-400">ポートフォリオ</p><a href={p.portfolio_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs">{p.portfolio_url}</a></div>
                  )}
                  {p?.resume_file_path && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 mb-1">スキルシート</p>
                      <a
                        href={p.resume_file_path}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-yellow-50 border border-yellow-300 text-yellow-800 hover:bg-yellow-100 transition-colors"
                      >
                        📄 {p.resume_file_path.split('/').pop()} をダウンロード
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            /* 編集フォーム */
            <Card>
              <CardHeader><CardTitle className="text-base">編集</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* スキルシートから自動入力 */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                    isDragging ? 'border-blue-400 bg-blue-100' : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-800 mb-1">スキルシートから自動入力</p>
                      <p className="text-xs text-blue-600">PDF・Excel・Word をドラッグ＆ドロップ、またはファイルを選択するとフォームに自動セットされます</p>
                      {parseError && <p className="text-xs text-red-500 mt-1">{parseError}</p>}
                    </div>
                    <div className="flex-shrink-0">
                      <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.xlsm,.docx,.doc" onChange={handleFileInputChange} className="hidden" />
                      <Button type="button" variant="outline" disabled={parsing} onClick={() => fileInputRef.current?.click()}
                        className="border-blue-300 text-blue-700 hover:bg-blue-100">
                        {parsing ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            解析中...
                          </span>
                        ) : 'ファイルを選択'}
                      </Button>
                    </div>
                  </div>
                  {resumeFileName && <p className="text-xs text-green-600 mt-2">📄 {resumeFileName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>氏名（イニシャル） <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>
                  <div><label className={labelCls}>氏名カナ</label><input className={inputCls} value={nameKana} onChange={e => setNameKana(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>メール</label><input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div><label className={labelCls}>電話</label><input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>所属</label><input className={inputCls} value={affiliation} onChange={e => setAffiliation(e.target.value)} /></div>
                  <div><label className={labelCls}>所属担当者</label><input className={inputCls} value={affiliationContact} onChange={e => setAffiliationContact(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>所属会社メール</label><input className={inputCls} type="email" value={affiliationEmail} onChange={e => setAffiliationEmail(e.target.value)} placeholder="info@example.co.jp" /></div>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>稼働状況</label>
                    <select className={inputCls} value={availabilityStatus} onChange={e => setAvailabilityStatus(e.target.value)}>
                      <option value="available">空き</option>
                      <option value="working">稼働中</option>
                      <option value="scheduled">◯月予定</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>案件名</label>
                    <input className={inputCls} value={currentProject} onChange={e => setCurrentProject(e.target.value)} placeholder="基幹システム開発" />
                  </div>
                  <div>
                    <label className={labelCls}>顧客</label>
                    <input className={inputCls} value={currentCustomer} onChange={e => setCurrentCustomer(e.target.value)} placeholder="株式会社ABC" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>稼働実績社数</label>
                    <input className={inputCls} type="number" min="0" value={pastClientCount} onChange={e => setPastClientCount(e.target.value)} placeholder="5" />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">スキル</p>
                  <div className="relative mb-2">
                    <input
                      className={inputCls}
                      value={skillQuery}
                      onChange={e => { setSkillQuery(e.target.value); searchSkills(e.target.value); }}
                      placeholder="スキルを検索..."
                    />
                    {(skillOptions.length > 0 || skillQuery.trim()) && (
                      <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-md">
                        {skillOptions.map(opt => (
                          <button key={opt.id} onClick={() => addSkill(opt)} className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50">
                            {opt.name}
                          </button>
                        ))}
                        {skillQuery.trim() && !skillOptions.some(o => o.name.toLowerCase() === skillQuery.trim().toLowerCase()) && (
                          <button
                            onClick={() => addNewSkill(skillQuery)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 text-green-700 border-t border-gray-100"
                          >
                            ＋「{skillQuery.trim()}」を新しいスキルとして追加
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {addedSkills.map((s, i) => (
                      <div key={s.skill_id ?? i} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SKILL_COLOR[s.category ?? 'other'] ?? SKILL_COLOR.other}`}>{s.skill_name}</span>
                        <input type="number" min="0" max="50" step="0.5" className="w-14 border rounded px-1 py-0.5 text-xs" value={s.experience_years}
                          onChange={e => setAddedSkills(prev => prev.map((x, j) => j === i ? { ...x, experience_years: e.target.value } : x))} />
                        <span className="text-xs text-gray-400">年</span>
                        <select className="border rounded px-1 py-0.5 text-xs" value={s.proficiency_level}
                          onChange={e => setAddedSkills(prev => prev.map((x, j) => j === i ? { ...x, proficiency_level: e.target.value } : x))}>
                          <option value="1">1: 入門</option>
                          <option value="2">2: 基礎</option>
                          <option value="3">3: 実務</option>
                          <option value="4">4: 上級</option>
                          <option value="5">5: エキスパート</option>
                        </select>
                        <button onClick={() => setAddedSkills(prev => prev.filter((_, j) => j !== i))} className="ml-auto text-gray-400 hover:text-red-500 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs text-gray-500 font-medium">希望条件</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>希望単価 下限（万円）</label><input className={inputCls} type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} /></div>
                    <div><label className={labelCls}>希望単価 上限（万円）</label><input className={inputCls} type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>稼働可能日</label><input className={inputCls} type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} /></div>
                    <div>
                      <label className={labelCls}>勤務形態</label>
                      <select className={inputCls} value={workStyle} onChange={e => setWorkStyle(e.target.value)}>
                        <option value="">選択</option>
                        <option value="remote">フルリモート</option>
                        <option value="hybrid">出社、リモートどちらも対応</option>
                        <option value="office">出社</option>
                      </select>
                    </div>
                  </div>
                  <div><label className={labelCls}>希望勤務地</label><input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} /></div>
                  <div>
                    <label className={labelCls}>自己PR</label>
                    <textarea className={inputCls + ' h-20 resize-none'} value={intro} onChange={e => setIntro(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="edit_is_public" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 rounded" />
                    <label htmlFor="edit_is_public" className="text-sm text-gray-700">マッチング市場に公開する</label>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleUpdate} disabled={saving}>{saving ? '更新中...' : '更新する'}</Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>キャンセル</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── 右：おすすめ案件 ── */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">🔍 おすすめ案件</h2>
          {projects.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-gray-400">案件がありません</CardContent></Card>
          ) : (
            projects.map(proj => (
              <Card key={proj.project_id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/public-projects/${proj.project_id}`)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-gray-800 leading-tight">{proj.project_title}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                      proj.score >= 80 ? 'bg-green-100 text-green-700' :
                      proj.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
                    }`}>{Math.round(proj.score)}%</span>
                  </div>
                  {(proj.unit_price_min || proj.unit_price_max) && (
                    <p className="text-xs text-gray-500 mb-2">💰 {proj.unit_price_min ?? '?'}〜{proj.unit_price_max ?? '?'}万円</p>
                  )}
                  <div className="space-y-1 mt-2">
                    <ScoreBar label="スキル" score={proj.skill_match_score} />
                    <ScoreBar label="単価" score={proj.price_match_score} />
                    <ScoreBar label="勤務地" score={proj.location_match_score} />
                    <ScoreBar label="時期" score={proj.availability_match_score} />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

