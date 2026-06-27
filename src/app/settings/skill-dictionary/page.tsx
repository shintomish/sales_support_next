'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Alias = { id: number; alias: string };
type Group = { canonical: string; aliases: Alias[] };

export default function SkillDictionaryPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin';

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [newCanonical, setNewCanonical] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [aliasInput, setAliasInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: Group[] }>('/api/v1/skill-aliases');
      setGroups(res.data.data ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g =>
      g.canonical.toLowerCase().includes(q) || g.aliases.some(a => a.alias.toLowerCase().includes(q)));
  }, [groups, filter]);

  const handleErr = (e: unknown, fallback: string) => {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    setErr(msg || fallback);
    setTimeout(() => setErr(''), 4000);
  };

  const addGroup = async () => {
    if (!newCanonical.trim() || !newAlias.trim()) return;
    setBusy(true); setErr('');
    try {
      await apiClient.post('/api/v1/skill-aliases', { canonical: newCanonical.trim(), alias: newAlias.trim() });
      setNewCanonical(''); setNewAlias('');
      await load();
    } catch (e) { handleErr(e, '追加に失敗しました'); }
    finally { setBusy(false); }
  };

  const addAlias = async (canonical: string) => {
    const alias = (aliasInput[canonical] ?? '').trim();
    if (!alias) return;
    setBusy(true); setErr('');
    try {
      await apiClient.post('/api/v1/skill-aliases', { canonical, alias });
      setAliasInput(prev => ({ ...prev, [canonical]: '' }));
      await load();
    } catch (e) { handleErr(e, '追加に失敗しました'); }
    finally { setBusy(false); }
  };

  const deleteAlias = async (id: number) => {
    setBusy(true); setErr('');
    try { await apiClient.delete(`/api/v1/skill-aliases/${id}`); await load(); }
    catch (e) { handleErr(e, '削除に失敗しました'); }
    finally { setBusy(false); }
  };

  const deleteGroup = async (canonical: string) => {
    if (!confirm(`「${canonical}」グループを丸ごと削除しますか？`)) return;
    setBusy(true); setErr('');
    try { await apiClient.delete('/api/v1/skill-aliases/group', { data: { canonical } }); await load(); }
    catch (e) { handleErr(e, '削除に失敗しました'); }
    finally { setBusy(false); }
  };

  const renameGroup = async (from: string) => {
    const to = prompt(`正規名を変更：「${from}」→`, from);
    if (!to || to.trim() === '' || to.trim() === from) return;
    setBusy(true); setErr('');
    try { await apiClient.put('/api/v1/skill-aliases/rename', { from, to: to.trim() }); await load(); }
    catch (e) { handleErr(e, '改名に失敗しました'); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-gray-800">スキル辞書（同義語・名寄せ）</h1>
      <p className="text-xs text-gray-500 mt-1">
        表記揺れ・別名を「正規名」でまとめると、検索とスコア照合で同じものとして扱われます（例: Java / JAVA / ジャバ、社内SE / 情シス）。
        全テナント共通のグローバル設定です。{isAdmin ? '' : '（編集は管理者のみ）'}
      </p>

      {err && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>}

      {/* 新規グループ追加（管理者） */}
      {isAdmin && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">＋ 新しい正規名を追加</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">正規名（代表）</label>
              <Input value={newCanonical} onChange={e => setNewCanonical(e.target.value)} placeholder="例: Java" className="w-48"
                onKeyDown={e => { if (e.key === 'Enter') addGroup(); }} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">最初の別名</label>
              <Input value={newAlias} onChange={e => setNewAlias(e.target.value)} placeholder="例: ジャバ" className="w-48"
                onKeyDown={e => { if (e.key === 'Enter') addGroup(); }} />
            </div>
            <Button onClick={addGroup} disabled={busy || !newCanonical.trim() || !newAlias.trim()}>追加</Button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">正規名そのもの（例: Java）も別名として登録すると確実です。別物（Angular と AngularJS 等）は同じグループにしないでください。</p>
        </div>
      )}

      {/* 検索 */}
      <div className="mt-4 mb-2">
        <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="🔎 正規名・別名で絞り込み" className="max-w-xs" />
      </div>

      {/* グループ一覧 */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">{filter ? '該当する辞書項目がありません' : '辞書はまだ空です'}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(g => (
            <div key={g.canonical} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-900">{g.canonical}</span>
                {isAdmin && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => renameGroup(g.canonical)} className="text-xs text-gray-500 hover:text-blue-600">改名</button>
                    <button onClick={() => deleteGroup(g.canonical)} className="text-xs text-gray-500 hover:text-red-600">グループ削除</button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {g.aliases.map(a => (
                  <span key={a.id} className="inline-flex items-center gap-1 text-[12px] bg-gray-100 text-gray-700 rounded px-2 py-0.5">
                    {a.alias}
                    {isAdmin && (
                      <button onClick={() => deleteAlias(a.id)} disabled={busy}
                        className="text-gray-400 hover:text-red-600 leading-none" title="削除">×</button>
                    )}
                  </span>
                ))}
                {isAdmin && (
                  <span className="inline-flex items-center gap-1">
                    <input value={aliasInput[g.canonical] ?? ''} onChange={e => setAliasInput(prev => ({ ...prev, [g.canonical]: e.target.value }))}
                      placeholder="別名を追加" className="text-[12px] border border-gray-200 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      onKeyDown={e => { if (e.key === 'Enter') addAlias(g.canonical); }} />
                    <button onClick={() => addAlias(g.canonical)} disabled={busy || !(aliasInput[g.canonical] ?? '').trim()}
                      className="text-xs text-blue-600 hover:underline disabled:text-gray-300">＋</button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
