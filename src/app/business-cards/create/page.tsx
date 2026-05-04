'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApiError } from '@/lib/error-helpers';

const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
const MAX_SIZE_MB  = 20;
const CONCURRENCY  = 3;

type ItemStatus = 'queued' | 'detecting' | 'uploading' | 'completed' | 'failed';

interface UploadItem {
  id: string;
  source: File | Blob;
  preview: string;
  name: string;
  status: ItemStatus;
  error?: string;
  result?: { person_name?: string | null; company_name?: string | null };
}

const newId = () => Math.random().toString(36).slice(2, 11);

const statusBadge = (s: ItemStatus): { label: string; cls: string } => {
  switch (s) {
    case 'queued':     return { label: '待機',     cls: 'bg-gray-100 text-gray-600' };
    case 'detecting':  return { label: '名刺検出', cls: 'bg-purple-100 text-purple-700' };
    case 'uploading':  return { label: 'OCR処理',  cls: 'bg-blue-100 text-blue-700' };
    case 'completed':  return { label: '完了',     cls: 'bg-green-100 text-green-700' };
    case 'failed':     return { label: '失敗',     cls: 'bg-red-100 text-red-700' };
  }
};

export default function BusinessCardCreatePage() {
  const [items, setItems]               = useState<UploadItem[]>([]);
  const [dragOver, setDragOver]         = useState(false);
  const [running, setRunning]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [multiCardMode, setMultiCardMode] = useState(false);
  const [pdfReady, setPdfReady]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // pdf.js を動的読み込み (CDN の worker を利用してバージョン同期)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      if (mounted) setPdfReady(true);
    })().catch(() => {
      // pdf.js 失敗時は PDF アップロード不可だが画像は使える
    });
    return () => { mounted = false; };
  }, []);

  /** PDF をページごとに JPEG Blob 化して配列で返す */
  const expandPdf = useCallback(async (file: File): Promise<File[]> => {
    const pdfjs = await import('pdfjs-dist');
    const buf   = await file.arrayBuffer();
    const pdf   = await pdfjs.getDocument({ data: buf }).promise;
    const out: File[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x で OCR 精度確保
      const canvas = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (blob) {
        const baseName = file.name.replace(/\.pdf$/i, '');
        out.push(new File([blob], `${baseName}_p${p}.jpg`, { type: 'image/jpeg' }));
      }
    }
    return out;
  }, []);

  /** 受け付けたファイル群を items に追加 (PDF は展開) */
  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files);
    const added: UploadItem[] = [];

    for (const file of arr) {
      if (!ACCEPT_TYPES.includes(file.type)) {
        setError(`${file.name} は対応していない形式です（JPEG/PNG/PDF）`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${file.name} は ${MAX_SIZE_MB}MB を超えています`);
        continue;
      }

      if (file.type === 'application/pdf') {
        if (!pdfReady) { setError('PDF処理の準備中です。少し待って再度お試しください'); continue; }
        try {
          const pages = await expandPdf(file);
          for (const p of pages) {
            added.push({
              id: newId(), source: p, preview: URL.createObjectURL(p),
              name: p.name, status: 'queued',
            });
          }
        } catch (e: unknown) {
          setError(`${file.name}: PDF展開失敗 (${(e as ApiError)?.message ?? 'unknown'})`);
        }
      } else {
        added.push({
          id: newId(), source: file, preview: URL.createObjectURL(file),
          name: file.name, status: 'queued',
        });
      }
    }
    if (added.length) setItems(prev => [...prev, ...added]);
  }, [expandPdf, pdfReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const it = prev.find(x => x.id === id);
      if (it) URL.revokeObjectURL(it.preview);
      return prev.filter(x => x.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach(it => URL.revokeObjectURL(it.preview));
    setItems([]);
    setError(null);
  };

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  /** 1画像内の複数名刺を /cards/detect で分割 → 新たな queued items に置換 */
  const splitMultiCard = async (item: UploadItem): Promise<UploadItem[]> => {
    const fd = new FormData();
    fd.append('image', item.source, item.name);
    const res = await apiClient.post<{ count: number; cards: string[] }>('/api/v1/cards/detect', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (res.data.count <= 1) return [item]; // 1枚なら分割なし
    return res.data.cards.map((dataUrl, idx) => {
      const blob = dataUrlToBlob(dataUrl);
      return {
        id: newId(),
        source: blob,
        preview: URL.createObjectURL(blob),
        name: `${item.name} (${idx + 1})`,
        status: 'queued' as ItemStatus,
      };
    });
  };

  /** 1枚アップロード → /cards (status: queued → uploading → completed | failed) */
  const uploadOne = async (item: UploadItem) => {
    updateItem(item.id, { status: 'uploading', error: undefined });
    try {
      const fd = new FormData();
      fd.append('images[]', item.source, item.name);
      type CardUploadResult = {
        success: boolean;
        source_name?: string;
        data?: { person_name?: string | null; company_name?: string | null };
        error?: string;
      };
      const res = await apiClient.post<{ results: CardUploadResult[]; success_count: number; failure_count: number }>(
        '/api/v1/cards', fd, { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const r = res.data.results?.[0];
      if (r?.success) {
        updateItem(item.id, {
          status: 'completed',
          result: {
            person_name:  r.data?.person_name  ?? null,
            company_name: r.data?.company_name ?? null,
          },
        });
      } else {
        updateItem(item.id, { status: 'failed', error: r?.error ?? '登録に失敗しました' });
      }
    } catch (err: unknown) {
      const msg = (err as ApiError)?.response?.data?.message ?? (err as ApiError)?.message ?? 'アップロードに失敗しました';
      updateItem(item.id, { status: 'failed', error: msg });
    }
  };

  /** 並列上限付きでキュー処理 (multiCardMode の場合は事前分割) */
  const runQueue = async () => {
    if (running) return;
    setRunning(true);
    try {
      // multiCardMode: queued な item をひとつずつ /detect に投げて置換
      if (multiCardMode) {
        const queued = items.filter(it => it.status === 'queued');
        for (const it of queued) {
          updateItem(it.id, { status: 'detecting' });
          try {
            const replacements = await splitMultiCard(it);
            if (replacements.length === 1 && replacements[0].id === it.id) {
              updateItem(it.id, { status: 'queued' });
            } else {
              setItems(prev => {
                const filtered = prev.filter(x => x.id !== it.id);
                URL.revokeObjectURL(it.preview);
                return [...filtered, ...replacements];
              });
            }
          } catch (e: unknown) {
            updateItem(it.id, { status: 'failed', error: '名刺検出に失敗: ' + ((e as ApiError)?.message ?? '') });
          }
        }
      }

      // queued items のスナップショットを取得 → 並列上限付きで処理
      // （multiCardMode で items が変わっている可能性があるため再取得）
      const snapshot: UploadItem[] = await new Promise(resolve => {
        setItems(prev => { resolve(prev.filter(it => it.status === 'queued')); return prev; });
      });

      let cursor = 0;
      const next = (): UploadItem | null => snapshot[cursor++] ?? null;

      const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (true) {
          const it = next();
          if (!it) break;
          await uploadOne(it);
        }
      });
      await Promise.all(workers);
    } finally {
      setRunning(false);
    }
  };

  const retryFailed = () => {
    setItems(prev => prev.map(it =>
      it.status === 'failed' ? { ...it, status: 'queued', error: undefined } : it
    ));
    setTimeout(runQueue, 0);
  };

  const counts = {
    queued:    items.filter(i => i.status === 'queued').length,
    busy:      items.filter(i => i.status === 'uploading' || i.status === 'detecting').length,
    completed: items.filter(i => i.status === 'completed').length,
    failed:    items.filter(i => i.status === 'failed').length,
  };

  const allDone = items.length > 0 && counts.queued === 0 && counts.busy === 0;

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>← 戻る</Button>
        <h1 className="text-2xl font-bold text-gray-800">名刺アップロード</h1>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm mb-4">
          <span className="text-base">⚠️</span><span>{error}</span>
        </div>
      )}

      <Card className="mb-4 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">🪪 名刺画像を選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* オプション */}
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={multiCardMode}
              onChange={(e) => setMultiCardMode(e.target.checked)}
              disabled={running}
            />
            1画像に複数名刺が並んでいる場合に自動分割（横/縦並び）
          </label>

          {/* D&Dエリア */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${dragOver
                ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'}`}
          >
            <div className="text-5xl mb-3">☁️</div>
            <p className="font-semibold text-gray-700 mb-1">ここに名刺画像 / PDF をドラッグ＆ドロップ</p>
            <p className="text-sm text-gray-400 mb-4">または</p>
            <span className="inline-block bg-blue-500 hover:bg-blue-600 text-white text-sm px-5 py-2 rounded-md pointer-events-none transition-colors">
              ファイルを選択
            </span>
            <p className="text-xs text-gray-400 mt-4">
              対応: JPEG / PNG / PDF（{MAX_SIZE_MB}MB以内・複数選択可・PDFは自動でページ分割）
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_TYPES.join(',')}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* サマリと操作 */}
          {items.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-gray-600 flex gap-3">
                <span>{items.length}件</span>
                {counts.completed > 0 && <span className="text-green-600">完了 {counts.completed}</span>}
                {counts.busy      > 0 && <span className="text-blue-600">処理中 {counts.busy}</span>}
                {counts.queued    > 0 && <span className="text-gray-500">待機 {counts.queued}</span>}
                {counts.failed    > 0 && <span className="text-red-600">失敗 {counts.failed}</span>}
              </div>
              <div className="flex gap-2">
                {counts.failed > 0 && !running && (
                  <Button variant="outline" onClick={retryFailed}>失敗を再試行</Button>
                )}
                <Button variant="outline" onClick={clearAll} disabled={running}>クリア</Button>
                {!allDone && (
                  <Button onClick={runQueue} disabled={running || counts.queued === 0}>
                    {running ? '処理中...' : `${counts.queued}件をアップロード`}
                  </Button>
                )}
                {allDone && (
                  <Button onClick={() => router.push('/business-cards')}>一覧へ</Button>
                )}
              </div>
            </div>
          )}

          {/* per-card 進捗テーブル */}
          {items.length > 0 && (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 w-[80px]">プレビュー</th>
                    <th className="text-left px-3 py-2">ファイル名</th>
                    <th className="text-left px-3 py-2 w-[100px]">状態</th>
                    <th className="text-left px-3 py-2">結果 / エラー</th>
                    <th className="px-3 py-2 w-[60px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(it => {
                    const b = statusBadge(it.status);
                    return (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <Image src={it.preview} alt="" width={64} height={40} unoptimized className="w-16 h-10 object-cover rounded" />
                        </td>
                        <td className="px-3 py-2 truncate max-w-[200px]" title={it.name}>{it.name}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${b.cls}`}>
                            {b.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs truncate max-w-[280px]">
                          {it.status === 'completed' && it.result && (
                            <span>{it.result.company_name ?? '—'} / {it.result.person_name ?? '—'}</span>
                          )}
                          {it.status === 'failed' && (
                            <span className="text-red-600" title={it.error}>{it.error}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(it.id)}
                            disabled={it.status === 'uploading' || it.status === 'detecting'}
                            className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-30"
                          >×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使い方ガイド */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">💡 使い方</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
            <li>名刺画像 (JPEG/PNG) または PDF を選択 / D&D</li>
            <li>PDF は自動でページごとに分割されます</li>
            <li>「1画像に複数名刺」を ON にすると、横並び/縦並びを自動分割</li>
            <li>縦撮り画像は自動で横向きに回転されます</li>
            <li>並列{CONCURRENCY}件で OCR 処理。失敗しても他は継続、再試行可</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

/** data:image/jpeg;base64,... を Blob に変換 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/data:([^;]+);/)?.[1] ?? 'image/jpeg';
  const bin  = atob(base64);
  const buf  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}
