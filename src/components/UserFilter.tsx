'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/axios';

interface UserOption { id: number; name: string; role: string; }

interface Props {
  value: string;           // 'all' | user_id 文字列
  onChange: (value: string) => void;
  className?: string;
}

export default function UserFilter({ value, onChange, className = '' }: Props) {
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    apiClient.get('/api/v1/users')
      .then(res => setUsers(res.data))
      .catch(() => {});
  }, []);

  const cls = className ||
    'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
      <option value="all">👥 ALL</option>
      {users.map(u => (
        <option key={u.id} value={String(u.id)}>{u.name}</option>
      ))}
    </select>
  );
}

/**
 * ロールに応じた初期フィルタ値を返す
 * - tenant_user: 自分のID（自分のデータのみ）
 * - tenant_admin / super_admin: 'all'
 */
export function defaultUserFilter(user: { id: number; role: string } | null): string {
  if (!user) return 'all';
  return user.role === 'tenant_user' ? String(user.id) : 'all';
}
