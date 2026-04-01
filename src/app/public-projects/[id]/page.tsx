'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
}
interface RecommendedEngineer {
  engineer_id: number; engineer_name: string; affiliation: string | null;
  available_from: string | null; work_style: string | null;
  desired_unit_price_min: number | null; desired_unit_price_max: number | null;
  score: number; skill_match_score: number; price_match_score: number;
  location_match_score: number; availability_match_score: number;
  skills: { name: string; experience_years: number }[];
}
interface EngineerOption { id: number; name: string; affiliation: string | null; }

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

export default function PublicProjectDetailPage() {
  const { id } = useParams();
  const router  = useRouter();
  const [project, setProject]       = useState<PublicProject | null>(null);
  const [recommended, setRecommended] = useState<RecommendedEngineer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [engineerOptions, setEngineerOptions] = useState<EngineerOption[]>([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [applyMessage, setApplyMessage]   = useState('');
  const [applying, setApplying]     = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);

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
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else if (err.response?.status === 404) router.push('/public-projects');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const openApplyModal = async () => {
    const res = await apiClient.get('/api/v1/engineers', { params: { per_page: 100 } });
    setEngineerOptions(res.data.data.map((e: any) => ({ id: e.id, name: e.name, affiliation: e.affiliation })));
    setShowApplyModal(true);
    setApplyError('');
    setApplySuccess(false);
  };

  const handleApply = async () => {
    if (!selectedEngineerId) { setApplyError('技術者を選択してください'); return; }
    setApplying(true); setApplyError('');
    try {
      await apiClient.post('/api/v1/applications', {
        project_id:           Number(id),
        engineer_id:          Number(selectedEngineerId),
        proposed_unit_price:  proposedPrice ? Number(proposedPrice) : null,
        message:              applyMessage || null,
      });
      setApplySuccess(true);
      setProject(prev => prev ? { ...prev, applications_count: prev.applications_count + 1 } : prev);
      setTimeout(() => { setShowApplyModal(false); setApplySuccess(false); }, 1500);
    } catch (err: any) {
      setApplyError(err.response?.data?.message ?? '応募に失敗しました');
    } finally { setApplying(false); }
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
                  {project.required_skills.map(s => (
                    <div key={s.skill_id} className="flex items-center gap-2">
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
        </div>

        {/* ── 右：おすすめ技術者 ── */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">🧑‍💻 おすすめ技術者</h2>
          {recommended.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-gray-400">技術者が見つかりません<br /><span className="text-xs">（公開設定済みの技術者のみ表示）</span></CardContent></Card>
          ) : (
            recommended.map(eng => (
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
          )}
        </div>
      </div>

      {/* ── 応募モーダル ── */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">案件に応募する</h2>
              <button onClick={() => setShowApplyModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4 truncate">{project.title}</p>

            {applySuccess ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-2">✅</p>
                <p className="text-green-600 font-medium">応募が完了しました</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>技術者を選択 <span className="text-red-500">*</span></label>
                  <select
                    className={inputCls}
                    value={selectedEngineerId}
                    onChange={e => setSelectedEngineerId(e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {engineerOptions.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name}{e.affiliation ? ` (${e.affiliation})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>提案単価（万円/月）</label>
                  <input
                    className={inputCls} type="number" min="0"
                    value={proposedPrice}
                    onChange={e => setProposedPrice(e.target.value)}
                    placeholder={`${project.unit_price_min ?? ''}〜${project.unit_price_max ?? ''}万円`}
                  />
                </div>
                <div>
                  <label className={labelCls}>アピールメッセージ</label>
                  <textarea
                    className={inputCls + ' h-24 resize-none'}
                    value={applyMessage}
                    onChange={e => setApplyMessage(e.target.value)}
                    placeholder="スキルのアピールポイントなど"
                  />
                </div>
                {applyError && <p className="text-xs text-red-500">{applyError}</p>}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowApplyModal(false)} className="flex-1">キャンセル</Button>
                  <Button onClick={handleApply} disabled={applying} className="flex-1">
                    {applying ? '送信中...' : '応募する'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
