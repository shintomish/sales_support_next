'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Toast from '@/components/Toast';
import type { ApiError } from '@/lib/error-helpers';

// ── 型定義 ────────────────────────────────────────────────
interface MonthlySalesRow {
  year: number;
  month: number;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  detail_count: number;
}
interface SalesTotal {
  revenue: number;
  cost: number;
  profit: number;
  detail_count: number;
}
interface DetailRow {
  ses_contract_id: number;
  engineer_name: string | null;
  category: string | null;
  revenue: number;
  cost: number;
  profit: number;
}

const yen = (n: number) => `¥${Number(n).toLocaleString('ja-JP')}`;

export default function MonthlySalesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MonthlySalesRow[]>([]);
  const [total, setTotal] = useState<SalesTotal | null>(null);
  const [fiscalYear, setFiscalYear] = useState<number | null>(null);
  const [period, setPeriod] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  // トースト
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToast(message);
  };

  // 明細ドリルダウン
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // fy 未指定なら当年度をサーバーが返す
  const fetchSummary = useCallback(async (fy?: number) => {
    try {
      setError(null);
      setOpenKey(null);
      const res = await apiClient.get('/api/v1/monthly-sales', {
        params: fy ? { fiscal_year: fy } : {},
      });
      setRows(res.data.monthly_sales ?? []);
      setTotal(res.data.total ?? null);
      setFiscalYear(res.data.fiscal_year ?? null);
      setPeriod(res.data.period ?? null);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleRecompute = async () => {
    if (!fiscalYear) return;
    setRecomputing(true);
    try {
      const res = await apiClient.post('/api/v1/monthly-sales/recompute', {
        fiscal_year: fiscalYear,
      });
      showToast(`${fiscalYear}年度を再集計しました（${res.data.detail_count}件）`);
      await fetchSummary(fiscalYear);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else showToast('再集計に失敗しました', 'error');
    } finally {
      setRecomputing(false);
    }
  };

  const toggleDetails = async (row: MonthlySalesRow) => {
    const key = `${row.year}-${row.month}`;
    if (openKey === key) { setOpenKey(null); return; }
    setOpenKey(key);
    setDetails([]);
    setDetailLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/monthly-sales/${row.year}/${row.month}/details`);
      setDetails(res.data.details ?? []);
    } catch {
      showToast('明細の取得に失敗しました', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const fyLabel = fiscalYear
    ? `${fiscalYear}年度${period ? `（${period}期）` : ''}`
    : '—';

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto py-4 md:py-6 px-4 md:px-6">
      {/* ヘッダー：年度切替 + 再集計 */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4 flex-shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">📈 月別売上（確定・SES台帳ベース）</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={!fiscalYear || loading}
              onClick={() => fiscalYear && fetchSummary(fiscalYear - 1)}>←</Button>
            <span className="min-w-[140px] text-center font-semibold text-gray-700">{fyLabel}</span>
            <Button variant="outline" size="sm" disabled={!fiscalYear || loading}
              onClick={() => fiscalYear && fetchSummary(fiscalYear + 1)}>→</Button>
          </div>
          <Button onClick={handleRecompute} disabled={recomputing || !fiscalYear}>
            {recomputing ? '再集計中…' : 'この年度を再集計'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3 flex-shrink-0">
        決算月で区切った会計年度（{fiscalYear ? `${fiscalYear - 1}年10月〜${fiscalYear}年9月` : ''}）。
        契約期間ベース・月単位粗計上。SES台帳を更新したら「この年度を再集計」を押してください。
      </p>

      {/* サマリテーブル */}
      <Card className="shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <CardContent className="p-0 flex flex-col h-full overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">読み込み中...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-gray-600 mb-3">{error}</p>
              <Button onClick={() => fetchSummary(fiscalYear ?? undefined)}>再試行</Button>
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10 border-b">
                  <tr className="text-gray-500 text-xs">
                    <th className="text-left  px-4 py-3 font-semibold">年月</th>
                    <th className="text-right px-4 py-3 font-semibold">売上</th>
                    <th className="text-right px-4 py-3 font-semibold">仕入</th>
                    <th className="text-right px-4 py-3 font-semibold">利益</th>
                    <th className="text-right px-4 py-3 font-semibold">件数</th>
                    <th className="text-center px-4 py-3 font-semibold">明細</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const key = `${row.year}-${row.month}`;
                    const isOpen = openKey === key;
                    return (
                      <Fragment key={key}>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{row.label}</td>
                          <td className="px-4 py-3 text-right text-gray-800">{yen(row.revenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{yen(row.cost)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">{yen(row.profit)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{row.detail_count}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleDetails(row)}
                              className="text-blue-600 hover:underline text-xs"
                              disabled={row.detail_count === 0}>
                              {row.detail_count === 0 ? '—' : isOpen ? '閉じる' : '表示'}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50/60">
                            <td colSpan={6} className="px-4 py-3">
                              {detailLoading ? (
                                <p className="text-xs text-gray-400 py-2">明細を読み込み中...</p>
                              ) : details.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">明細がありません</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-400 border-b">
                                      <th className="text-left  px-2 py-1.5 font-medium">技術者</th>
                                      <th className="text-left  px-2 py-1.5 font-medium">区分</th>
                                      <th className="text-right px-2 py-1.5 font-medium">売上</th>
                                      <th className="text-right px-2 py-1.5 font-medium">仕入</th>
                                      <th className="text-right px-2 py-1.5 font-medium">利益</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {details.map(d => (
                                      <tr key={d.ses_contract_id} className="border-b border-gray-100">
                                        <td className="px-2 py-1.5 text-gray-700">{d.engineer_name ?? '—'}</td>
                                        <td className="px-2 py-1.5 text-gray-500">
                                          {d.category === 'engineer' ? '技術者' : d.category === 'project' ? '案件' : '—'}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-gray-700">{yen(d.revenue)}</td>
                                        <td className="px-2 py-1.5 text-right text-gray-500">{yen(d.cost)}</td>
                                        <td className="px-2 py-1.5 text-right text-emerald-600">{yen(d.profit)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                {total && (
                  <tfoot className="sticky bottom-0 bg-white border-t-2 border-gray-200">
                    <tr className="font-bold text-gray-800">
                      <td className="px-4 py-3">{fiscalYear}年度 合計</td>
                      <td className="px-4 py-3 text-right">{yen(total.revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{yen(total.cost)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{yen(total.profit)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{total.detail_count}</td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Toast message={toast} onClose={() => setToast(null)} type={toastType} />
    </div>
  );
}
