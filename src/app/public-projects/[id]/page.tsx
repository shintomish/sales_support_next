'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApiError } from '@/lib/error-helpers';

const Em = () => <span className="text-gray-300 text-xs">—</span>;
const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : null;
const WORK_STYLE_LABEL: Record<string, string> = { remote: '🏠 フルリモート', office: '🏢 出社', hybrid: '🔄 ハイブリッド' };
const SKILL_COLOR: Record<string, string> = {
  language: 'bg-blue-100 text-blue-700', framework: 'bg-purple-100 text-purple-700',
  database: 'bg-green-100 text-green-700', infrastructure: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
};

interface RequiredSkill { skill_id: number; skill_name: string; category: string | null; is_required: boolean; min_experience_years: number | null; }
interface PublicProject {
  id: number; title: string; description: string | null; end_client: string | null;
  posted_by_customer_name: string | null;
  unit_price_min: number | null; unit_price_max: number | null;
  contract_type: string | null; contract_period_months: number | null;
  start_date: string | null; work_style: string | null; remote_frequency: string | null;
  work_location: string | null; nearest_station: string | null;
  deduction_hours: number | null; overtime_hours: number | null;
  settlement_unit_minutes: number | null;
  required_experience_years: number | null; team_size: number | null;
  interview_count: number | null; headcount: number;
  status: string; views_count: number; applications_count: number;
  expires_at: string | null;
  required_skills: RequiredSkill[];
  is_favorite: boolean;
  project_mail_source_id: number | null;
  mail_from_address: string | null;
  mail_from_name: string | null;
  mail_sales_contact: string | null;
  mail_body_text: string | null;
}
interface RecommendedEngineer {
  engineer_id: number; engineer_name: string; affiliation: string | null;
  affiliation_type: string | null; engineer_mail_source_id: number | null;
  available_from: string | null; work_style: string | null;
  desired_unit_price_min: number | null; desired_unit_price_max: number | null;
  score: number; skill_match_score: number; price_match_score: number;
  location_match_score: number; availability_match_score: number;
  skills: { name: string; experience_years: number }[];
}
function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-400' : 'bg-red-400';
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

interface EmailBodyTemplate {
  name: string; name_en: string; department: string; position: string;
  email: string; mobile: string; body_text?: string | null;
}

function buildEmailBody(greeting: string, mainContent: string, tpl: EmailBodyTemplate | null): string {
  if (tpl?.body_text) {
    return tpl.body_text
      .replace(/^.*?様\s*/u, `${greeting}\n\n`)
      .replace('（本文）', mainContent)
  }
  const intro = tpl
    ? `いつも大変お世話になっております。\n株式会社アイゼン・ソリューションの${tpl.name}です。`
    : `いつも大変お世話になっております。`
  const sig = tpl
    ? `_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/\n　　株式会社アイゼン・ソリューション\n　${tpl.department ?? ''}\n　${tpl.position ?? ''}\n　${tpl.name}${tpl.name_en ? `（${tpl.name_en}）` : ''}\n\n　〒332-0017\n　埼玉県川口市栄町3-12-11 コスモ川口栄町2F\n　Tel：048-253-3922　Fax：048-271-9355\n\n　E-Mail：${tpl.email ?? ''}\n　Mobile：${tpl.mobile ?? ''}\n\n　URL:https://www.aizen-sol.co.jp\n_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/`
    : ''
  return `${greeting}\n\n${intro}\n\n${mainContent}\n\nお忙しいところ大変恐れ入りますが、ご検討いただけますと幸いでございます。\n何卒よろしくお願いいたします。\n${sig}`
}

export default function PublicProjectDetailPage() {
  const { id } = useParams();
  const router  = useRouter();
  const [project, setProject]       = useState<PublicProject | null>(null);
  const [recommended, setRecommended] = useState<RecommendedEngineer[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<EmailBodyTemplate | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'' | 'self' | 'bp' | 'mail'>('');
  const [loading, setLoading]       = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [toName, setToName] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mailBodyOpen, setMailBodyOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'text-xs text-gray-500 mb-1 block';

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, recRes] = await Promise.all([
        apiClient.get(`/api/v1/public-projects/${id}`),
        apiClient.get(`/api/v1/matching/projects/${id}/engineers`).catch(() => ({ data: { data: [] } })),
      ]);
      setProject(projRes.data.data);
      setRecommended(recRes.data.data);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else if ((err as ApiError).response?.status === 404) router.push('/public-projects');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchProject(); }, [fetchProject]);
  useEffect(() => {
    apiClient.get('/api/v1/email-body-templates/me').then(res => {
      if (res.data) setEmailTemplate(res.data);
    }).catch(() => {});
  }, []);

  const openApplyModal = () => {
    if (!project) return;
    const contact = project.mail_sales_contact || project.mail_from_name || '';
    setToName(contact ? `${contact} 様` : (project.mail_from_address ? 'ご担当者 様' : ''));
    setTo(project.mail_from_address ?? '');
    setSubject(`【技術者ご紹介】${project.title}`);

    // おすすめ技術者の情報を本文に含める
    const greeting = contact ? `${contact} 様` : 'ご担当者様';
    const engineerLines = recommended.map(e => {
      const skills = e.skills.slice(0, 5).map(s => s.name).join('／');
      const avail = e.available_from ? `${fmtDate(e.available_from)}〜` : '';
      return `・${e.engineer_name}（${e.affiliation ?? ''}）\n　スキル：${skills || '—'}　稼働：${avail || '—'}`;
    }).join('\n');
    const mainContent = recommended.length > 0
      ? `この度は、貴社のご要件に対応可能なエンジニアをご紹介させていただきたく、ご連絡差し上げました。\n\n【ご紹介エンジニア（${recommended.length}名）】\n${engineerLines}\n\n各エンジニアのスキルシートをご要望の場合は、お気軽にご返信ください。\nまた、面談のご調整も随時承っております。`
      : `この度は、貴社のご要件に対応可能なエンジニアをご紹介させていただきたく、ご連絡差し上げました。`;
    setBody(buildEmailBody(greeting, mainContent, emailTemplate));

    setAttachments([]);
    setSent(false);
    setShowApplyModal(true);
  };

  const handleSend = async () => {
    if (!to.trim()) { alert('送信先メールアドレスを入力してください'); return; }
    if (!subject.trim()) { alert('件名を入力してください'); return; }
    if (!body.trim()) { alert('本文を入力してください'); return; }
    if (!confirm(`${toName || to} に送信しますか？`)) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('to', to);
      formData.append('to_name', toName);
      formData.append('subject', subject);
      formData.append('body', body);
      attachments.forEach(f => formData.append('attachments[]', f));
      await apiClient.post(`/api/v1/public-projects/${id}/send-proposal`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSent(true);
      setTimeout(() => setShowApplyModal(false), 2000);
    } catch {
      alert('送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) setAttachments(prev => [...prev, ...files]);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setAttachments(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async () => {
    if (!confirm('この案件を削除しますか？')) return;
    await apiClient.delete(`/api/v1/public-projects/${id}`);
    router.push('/public-projects');
  };

  const toggleFavorite = async () => {
    if (!project) return;
    await apiClient.post(`/api/v1/public-projects/${id}/favorite`);
    setProject(prev => prev ? { ...prev, is_favorite: !prev.is_favorite } : prev);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!project) return null;

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push('/public-projects')}>← 一覧</Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-800">{project.title}</h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                project.status === 'open' ? 'bg-green-100 text-green-700' :
                project.status === 'filled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {project.status === 'open' ? '募集中' : project.status === 'filled' ? '充足' : '終了'}
              </span>
            </div>
            {project.posted_by_customer_name && (
              <p className="text-sm text-gray-400 mt-1">掲載: {project.posted_by_customer_name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={toggleFavorite} className="text-2xl hover:scale-110 transition-transform">
            {project.is_favorite ? '♥' : '♡'}
          </button>
          {project.status === 'open' && (
            <Button onClick={openApplyModal}>この案件に応募する</Button>
          )}
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleDelete}>削除</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── 左：案件詳細 ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* 契約条件 */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">💼 契約条件</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">単価</p>
                <p className="font-medium">
                  {(project.unit_price_min || project.unit_price_max)
                    ? `${project.unit_price_min ?? '?'}〜${project.unit_price_max ?? '?'}万円/月`
                    : <Em />
                  }
                </p>
              </div>
              <div><p className="text-xs text-gray-400">契約形態</p><p>{project.contract_type ?? <Em />}</p></div>
              <div><p className="text-xs text-gray-400">稼働開始</p><p>{fmtDate(project.start_date) ?? <Em />}</p></div>
              <div><p className="text-xs text-gray-400">契約期間</p><p>{project.contract_period_months ? `${project.contract_period_months}ヶ月` : '長期想定'}</p></div>
              {(project.deduction_hours || project.overtime_hours) && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">精算条件</p>
                  <p>{project.deduction_hours ?? '?'}h 〜 {project.overtime_hours ?? '?'}h
                    {project.settlement_unit_minutes && <span className="text-gray-400 text-xs ml-1">（{project.settlement_unit_minutes}分単位）</span>}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 勤務条件 */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">🏢 勤務条件</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-400">勤務形態</p><p>{project.work_style ? WORK_STYLE_LABEL[project.work_style] : <Em />}</p></div>
              <div><p className="text-xs text-gray-400">リモート頻度</p><p>{project.remote_frequency ?? <Em />}</p></div>
              <div><p className="text-xs text-gray-400">勤務地</p><p>{project.work_location ?? <Em />}</p></div>
              <div><p className="text-xs text-gray-400">最寄駅</p><p>{project.nearest_station ?? <Em />}</p></div>
              <div><p className="text-xs text-gray-400">必要経験年数</p><p>{project.required_experience_years != null ? `${project.required_experience_years}年以上` : <Em />}</p></div>
              <div><p className="text-xs text-gray-400">チーム規模</p><p>{project.team_size != null ? `${project.team_size}名` : <Em />}</p></div>
              <div><p className="text-xs text-gray-400">面談回数</p><p>{project.interview_count != null ? `${project.interview_count}回` : <Em />}</p></div>
              <div><p className="text-xs text-gray-400">募集人数</p><p>{project.headcount}名</p></div>
            </CardContent>
          </Card>

          {/* 必須スキル */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">🔧 必須スキル</CardTitle></CardHeader>
            <CardContent>
              {project.required_skills.length === 0 ? (
                <p className="text-sm text-gray-400">スキル要件未設定</p>
              ) : (
                <div className="space-y-2">
                  {project.required_skills.map((s, i) => (
                    <div key={s.skill_id ?? i} className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SKILL_COLOR[s.category ?? 'other'] ?? SKILL_COLOR.other}`}>
                        {s.skill_name}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${
                        s.is_required ? 'text-red-600 border-red-200 bg-red-50' : 'text-gray-500 border-gray-200'
                      }`}>
                        {s.is_required ? '必須' : '歓迎'}
                      </span>
                      {s.min_experience_years && (
                        <span className="text-xs text-gray-500">{s.min_experience_years}年以上</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 案件説明 */}
          {project.description && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">📝 案件説明</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.description}</p>
              </CardContent>
            </Card>
          )}

          {/* 統計 */}
          <div className="flex gap-6 text-sm text-gray-500">
            <span>👁 閲覧 {project.views_count}回</span>
            <span>📝 応募 {project.applications_count}件</span>
            {project.expires_at && <span>⏰ 締切 {fmtDate(project.expires_at)}</span>}
            {project.end_client && <span>🏢 エンド: {project.end_client}</span>}
          </div>

          {/* 元メール本文 */}
          {project.mail_body_text && (
            <Card className="overflow-hidden">
              <button
                onClick={() => setMailBodyOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
              >
                <span>📧 元メール本文</span>
                <span className="text-gray-400">{mailBodyOpen ? '▲ 閉じる' : '▼ 開く'}</span>
              </button>
              {mailBodyOpen && (
                <CardContent className="max-h-64 overflow-y-auto border-t border-gray-200 p-4">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{project.mail_body_text}</pre>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* ── 右：おすすめ技術者 ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-700">🧑‍💻 おすすめ技術者</h2>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50 p-0.5 gap-0.5">
              {([
                { value: '' as const, label: '全て' },
                { value: 'self' as const, label: '自社' },
                { value: 'bp' as const, label: 'BP' },
                { value: 'mail' as const, label: 'メール' },
              ]).map(opt => (
                <button key={opt.value} onClick={() => setSourceFilter(opt.value)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors font-medium ${
                    sourceFilter === opt.value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const filtered = recommended.filter(eng => {
              if (sourceFilter === 'self') return eng.affiliation_type === 'self';
              if (sourceFilter === 'bp') return eng.affiliation_type && eng.affiliation_type !== 'self' && !eng.engineer_mail_source_id;
              if (sourceFilter === 'mail') return !!eng.engineer_mail_source_id;
              return true;
            });
            return filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-gray-400">技術者が見つかりません<br /><span className="text-xs">（公開設定済みの技術者のみ表示）</span></CardContent></Card>
          ) : (
            filtered.map(eng => (
              <Card key={eng.engineer_id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/engineers/${eng.engineer_id}`)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{eng.engineer_name}</p>
                      {eng.affiliation && <p className="text-xs text-gray-400">{eng.affiliation}</p>}
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                      eng.score >= 80 ? 'bg-green-100 text-green-700' :
                      eng.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
                    }`}>{Math.round(eng.score)}%</span>
                  </div>
                  {(eng.desired_unit_price_min || eng.desired_unit_price_max) && (
                    <p className="text-xs text-gray-500 mb-2">💰 {eng.desired_unit_price_min ?? '?'}〜{eng.desired_unit_price_max ?? '?'}万円</p>
                  )}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {eng.skills.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {s.name}{s.experience_years > 0 && `(${s.experience_years}年)`}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <ScoreBar label="スキル" score={eng.skill_match_score} />
                    <ScoreBar label="単価" score={eng.price_match_score} />
                    <ScoreBar label="勤務地" score={eng.location_match_score} />
                    <ScoreBar label="時期" score={eng.availability_match_score} />
                  </div>
                </CardContent>
              </Card>
            ))
          );
          })()}
        </div>
      </div>

      {/* ── 提案メール送信モーダル ── */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowApplyModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">📤 案件に応募する</p>
                <p className="text-xs text-gray-400 truncate max-w-sm">{project.title}</p>
              </div>
              <button onClick={() => setShowApplyModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {sent ? (
              <div className="p-10 text-center">
                <p className="text-5xl mb-4">✅</p>
                <p className="text-base font-bold text-gray-800 mb-1">送信しました</p>
                <p className="text-sm text-gray-500">{toName || to}</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 flex-1 overflow-y-auto space-y-3">
                  {/* 元メール本文 */}
                  {project.mail_body_text && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setMailBodyOpen(v => !v)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium text-gray-700"
                      >
                        <span>📧 元メール本文</span>
                        <span className="text-gray-400">{mailBodyOpen ? '▲ 閉じる' : '▼ 開く'}</span>
                      </button>
                      {mailBodyOpen && (
                        <div className="px-3 py-2 bg-white max-h-48 overflow-y-auto border-t border-gray-200">
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{project.mail_body_text}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 宛先 */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-500 w-12 shrink-0">宛先名</span>
                      <input className={inputCls} value={toName} onChange={e => setToName(e.target.value)} placeholder="担当者名" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-500 w-12 shrink-0">送信先</span>
                      <input className={inputCls} type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="example@example.com" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-500 w-12 shrink-0">件名</span>
                      <input className={inputCls} value={subject} onChange={e => setSubject(e.target.value)} />
                    </div>
                  </div>

                  {/* 本文 */}
                  <div>
                    <label className={labelCls}>本文</label>
                    <textarea className={inputCls + ' h-48 resize-y'} value={body} onChange={e => setBody(e.target.value)} />
                  </div>

                  {/* 添付ファイル D&D */}
                  <div
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <p className="text-xs text-blue-600 mb-1">スキルシート等をドラッグ＆ドロップ、またはファイルを選択</p>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100">ファイルを選択</Button>
                    {attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {attachments.map((f, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1 border">
                            <span className="truncate">📎 {f.name} ({(f.size / 1024).toFixed(1)}KB)</span>
                            <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 ml-2">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 border-t flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowApplyModal(false)}>閉じる</Button>
                  <Button onClick={handleSend} disabled={sending}>
                    {sending ? '送信中...' : '📤 送信する'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
