'use client';

import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/axios';

/**
 * 汎用お気に入りフック。
 * targetType: 'project_mail' | 'public_project' | 'engineer_mail' | 'engineer'
 * 一覧側で各行の★表示/トグルに使う（バックエンドは /favorites 系を共有）。
 */
export function useFavorites(targetType: string) {
  const [ids, setIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<Record<string, number[]>>('/api/v1/favorites/ids');
      setIds(new Set(res.data?.[targetType] ?? []));
    } catch { /* noop */ }
  }, [targetType]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (id: number) => {
    try {
      const res = await apiClient.post<{ favorited: boolean }>('/api/v1/favorites/toggle', {
        target_type: targetType, target_id: id,
      });
      setIds(prev => {
        const n = new Set(prev);
        if (res.data.favorited) n.add(id); else n.delete(id);
        return n;
      });
    } catch { /* noop */ }
  }, [targetType]);

  const isFav = useCallback((id: number) => ids.has(id), [ids]);

  return { isFav, toggle };
}
