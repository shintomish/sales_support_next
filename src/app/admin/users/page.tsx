'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';

type Role = 'super_admin' | 'tenant_admin' | 'tenant_user';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  tenant_id: number | null;
  supabase_uid: string | null;
  created_at: string;
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
  plan: string;
  ses_enabled: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  super_admin:  'スーパー管理者',
  tenant_admin: 'テナント管理者',
  tenant_user:  'メンバー',
};

const ROLE_BADGE: Record<Role, string> = {
  super_admin:  'bg-purple-100 text-purple-700 border border-purple-200',
  tenant_admin: 'bg-blue-100 text-blue-700 border border-blue-200',
  tenant_user:  'bg-gray-100 text-gray-700 border border-gray-200',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const loadingMe = useAuthStore((s) => s.loading);

  // ── ロールガード ──
  useEffect(() => {
    if (loadingMe) return;
    if (!me) return;
    if (me.role !== 'super_admin' && me.role !== 'tenant_admin') {
      router.replace('/dashboard');
    }
  }, [me, loadingMe, router]);

  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // フィルタ
  const [search,       setSearch]       = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [roleFilter,   setRoleFilter]   = useState<string>('');
  const [tenantFilter, setTenantFilter] = useState<string>('');

  // ダイアログ
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // ページネーション
  const PER_PAGE = 50;
  const [page, setPage] = useState(1);

  // ソート
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const isSuper = me?.role === 'super_admin';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (tenantFilter && isSuper) params.tenant_id = tenantFilter;
      const res = await apiClient.get('/api/v1/users', { params });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, tenantFilter, isSuper]);

  useEffect(() => {
    if (!me) return;
    fetchUsers();
    if (isSuper) {
      apiClient.get('/api/v1/tenants').then((r) => setTenants(r.data)).catch(() => {});
    }
  }, [me, fetchUsers, isSuper]);

  // フィルタ変更時はページ1にリセット
  useEffect(() => { setPage(1); }, [search, roleFilter, tenantFilter]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  };

  const tenantNameOf = (id: number | null) => tenants.find((t) => t.id === id)?.name ?? `tenant#${id ?? '-'}`;

  const sortedUsers = useMemo(() => {
    const get = (u: AdminUser): string => {
      switch (sortField) {
        case 'name':       return u.name ?? '';
        case 'email':      return u.email ?? '';
        case 'role':       return u.role ?? '';
        case 'tenant_id':  return tenantNameOf(u.tenant_id);
        case 'created_at': return u.created_at ?? '';
        default:           return '';
      }
    };
    const sorted = [...users].sort((a, b) => String(get(a)).localeCompare(String(get(b)), 'ja'));
    return sortOrder === 'desc' ? sorted.reverse() : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, sortField, sortOrder, tenants]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PER_PAGE));
  const pagedUsers = sortedUsers.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loadingMe) return null;
  if (!me || (me.role !== 'super_admin' && me.role !== 'tenant_admin')) return null;

  return (
    <div className="h-full flex flex-col p-6 max-w-6xl mx-auto w-full">
      {/* 上部: タイトル + フィルタ（固定） */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ユーザー管理</h1>
            <p className="text-sm text-gray-500 mt-1">
              {isSuper ? '全テナントのユーザーを管理できます' : '自テナントのユーザーを管理できます'}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            ＋ 新規ユーザー
          </Button>
        </div>

        {/* フィルタ */}
        <div className="flex flex-wrap gap-3 mb-3">
          <Input
            placeholder="名前またはメールで検索"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput); }}
            className="w-64"
          />
          <Button variant="outline" onClick={() => setSearch(searchInput)}>検索</Button>
          <Button variant="outline" onClick={() => { setSearchInput(''); setSearch(''); setRoleFilter(''); setTenantFilter(''); }}>クリア</Button>
          <select className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
            value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">全ロール</option>
            <option value="super_admin">スーパー管理者</option>
            <option value="tenant_admin">テナント管理者</option>
            <option value="tenant_user">メンバー</option>
          </select>
          {isSuper && (
            <select className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
              <option value="">全テナント</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* 詳細部 = 一覧テーブル（thead 固定 + tbody スクロール）+ ページネーション */}
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <SortableHeader label="名前"     field="name"       sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label="メール"   field="email"      sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label="ロール"   field="role"       sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                {isSuper && (
                  <SortableHeader label="テナント" field="tenant_id" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                )}
                <SortableHeader label="作成日"   field="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <th className="text-right px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={isSuper ? 6 : 5} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : pagedUsers.length === 0 ? (
                <tr><td colSpan={isSuper ? 6 : 5} className="px-4 py-8 text-center text-gray-400">ユーザーがいません</td></tr>
              ) : pagedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  {isSuper && <td className="px-4 py-3 text-gray-600">{tenantNameOf(u.tenant_id)}</td>}
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button className="text-xs px-2 py-1 rounded hover:bg-blue-100 text-blue-600"
                      onClick={() => setEditTarget(u)}>編集</button>
                    <button className="text-xs px-2 py-1 rounded hover:bg-amber-100 text-amber-600"
                      onClick={async () => {
                        if (!confirm(`${u.email} に招待メールを再送しますか？`)) return;
                        try {
                          await apiClient.post(`/api/v1/users/${u.id}/resend-invite`);
                          alert('招待メールを再送しました');
                        } catch (err: unknown) {
                          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '再送に失敗しました';
                          alert(msg);
                        }
                      }}>招待再送</button>
                    <button className="text-xs px-2 py-1 rounded hover:bg-red-100 text-red-600"
                      onClick={() => setDeleteTarget(u)} disabled={u.id === me.id}>削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* ページネーション（下部固定） */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
          <span className="text-gray-600">
            {users.length === 0
              ? '0 件'
              : `${(page - 1) * PER_PAGE + 1}〜${Math.min(page * PER_PAGE, users.length)} / ${users.length} 件`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>前へ</Button>
            <span className="text-gray-600">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>次へ</Button>
          </div>
        </div>
      </div>

      {showCreate && (
        <UserFormDialog
          mode="create"
          isSuper={isSuper}
          tenants={tenants}
          myTenantId={me.tenant_id}
          onClose={() => setShowCreate(false)}
          onSubmit={async (data) => {
            try {
              await apiClient.post('/api/v1/users', data);
              setShowCreate(false);
              fetchUsers();
              alert('ユーザーを作成しました。招待メール（パスワード設定リンク）を送信しています。');
            } catch (err: unknown) {
              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '作成に失敗しました';
              alert(msg);
            }
          }}
        />
      )}

      {editTarget && (
        <UserFormDialog
          mode="edit"
          isSuper={isSuper}
          tenants={tenants}
          myTenantId={me.tenant_id}
          target={editTarget}
          isSelf={editTarget.id === me.id}
          onClose={() => setEditTarget(null)}
          onSubmit={async (data) => {
            try {
              await apiClient.put(`/api/v1/users/${editTarget.id}`, data);
              setEditTarget(null);
              fetchUsers();
            } catch (err: unknown) {
              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '更新に失敗しました';
              alert(msg);
            }
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="ユーザー削除"
          message={`${deleteTarget.name} (${deleteTarget.email}) を削除します。よろしいですか？\nこの操作は取り消せません。Supabase Auth からも完全削除されます。`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            try {
              await apiClient.delete(`/api/v1/users/${deleteTarget.id}`);
              setDeleteTarget(null);
              fetchUsers();
            } catch (err: unknown) {
              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '削除に失敗しました';
              alert(msg);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── ユーザー作成/編集ダイアログ ───
function UserFormDialog({
  mode, target, isSuper, tenants, myTenantId, isSelf, onClose, onSubmit,
}: {
  mode: 'create' | 'edit';
  target?: AdminUser;
  isSuper: boolean;
  tenants: Tenant[];
  myTenantId: number | null;
  isSelf?: boolean;
  onClose: () => void;
  onSubmit: (data: { name?: string; email?: string; role?: string; tenant_id?: number | null }) => Promise<void>;
}) {
  const [name,   setName]   = useState(target?.name ?? '');
  const [email,  setEmail]  = useState(target?.email ?? '');
  const [role,   setRole]   = useState<Role>(target?.role ?? 'tenant_user');
  const [tenantId, setTenantId] = useState<number | null>(target?.tenant_id ?? myTenantId);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const payload: { name?: string; email?: string; role?: string; tenant_id?: number | null } = {};
    if (mode === 'create') {
      payload.name  = name;
      payload.email = email;
      payload.role  = role;
      if (isSuper) payload.tenant_id = tenantId;
    } else {
      if (name !== target?.name) payload.name = name;
      if (email !== target?.email) payload.email = email;
      if (role !== target?.role) payload.role = role;
    }
    await onSubmit(payload);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{mode === 'create' ? '新規ユーザー作成' : 'ユーザー編集'}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">名前</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">メールアドレス</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
            {mode === 'create' && (
              <p className="text-xs text-gray-500 mt-1">作成後、このメアドにパスワード設定リンクが送信されます。</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">ロール</label>
            <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={isSelf}>
              <option value="tenant_user">メンバー (tenant_user)</option>
              <option value="tenant_admin">テナント管理者 (tenant_admin)</option>
              {isSuper && <option value="super_admin">スーパー管理者 (super_admin)</option>}
            </select>
            {isSelf && <p className="text-xs text-amber-600 mt-1">自分のロールは変更できません</p>}
          </div>
          {isSuper && mode === 'create' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">テナント</label>
              <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
                value={tenantId ?? ''}
                onChange={(e) => setTenantId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">（指定なし＝自テナント）</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={busy}>キャンセル</Button>
          <Button onClick={submit} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
            {busy ? '送信中...' : (mode === 'create' ? '作成して招待' : '更新')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 確認ダイアログ ───
function ConfirmDialog({ title, message, onCancel, onConfirm }: {
  title: string; message: string; onCancel: () => void; onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-2">{title}</h2>
        <p className="text-sm text-gray-600 whitespace-pre-line mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>キャンセル</Button>
          <Button onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
            disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">
            {busy ? '実行中...' : '削除する'}
          </Button>
        </div>
      </div>
    </div>
  );
}
