'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SelectedFile = { file: File; preview: string; };

const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_SIZE_MB  = 10;
const BUCKET       = 'business-cards';

/** Supabase Storage に画像をアップロードして公開URLを返す */
async function uploadToSupabase(file: File, tenantId: string): Promise<string> {
  const ext      = file.name.split('.').pop();
  const filename = `${tenantId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export default function BusinessCardCreatePage() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [dragOver, setDragOver]           = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [progress, setProgress]           = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError]                 = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const processFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: SelectedFile[] = [];
    arr.forEach(file => {
      if (!ACCEPT_TYPES.includes(file.type)) {
        setError(`${file.name} は対応していない形式です（JPEG/PNG のみ）`);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${file.name} は ${MAX_SIZE_MB}MB を超えています`);
        return;
      }
      valid.push({ file, preview: URL.createObjectURL(file) });
    });
    setSelectedFiles(prev => [...prev, ...valid]);
    if (valid.length > 0) setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAll = () => {
    selectedFiles.forEach(f => URL.revokeObjectURL(f.preview));
    setSelectedFiles([]);
    setError(null);
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) { setError('ファイルを選択してください'); return; }

    setUploading(true);
    setProgress(0);
    setProgressLabel('Supabase にアップロード中...');
    setError(null);

    try {
      // ── Step 1: Supabase Storage に画像をアップロード ──
      // tenant_id はLaravel APIから取得（/api/v1/me などがあれば使う）
      // なければ 'default' をフォールバックとして使用
      let tenantId = 'default';
      try {
        const meRes = await apiClient.get('/api/v1/me');
        tenantId = String(meRes.data.tenant_id ?? 'default');
      } catch {}

      const imageUrls: string[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const { file } = selectedFiles[i];
        setProgressLabel(`Supabase にアップロード中... (${i + 1}/${selectedFiles.length})`);
        setProgress(Math.round(((i + 0.5) / selectedFiles.length) * 60)); // 0〜60%

        const url = await uploadToSupabase(file, tenantId);
        imageUrls.push(url);
      }

      // ── Step 2: Laravel API に画像URLを送信してOCR・DB登録 ──
      setProgressLabel('OCR処理中... しばらくお待ちください');
      setProgress(70);

      await apiClient.post('/api/v1/cards', {
        image_urls: imageUrls,
      });

      setProgress(100);
      selectedFiles.forEach(f => URL.revokeObjectURL(f.preview));
      router.push('/business-cards');

    } catch (err: any) {
      const messages: string[] = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat() as string[]
        : [err.message ?? 'アップロードに失敗しました'];
      setError(messages.join(' / '));
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
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
            <p className="font-semibold text-gray-700 mb-1">ここに名刺画像をドラッグ＆ドロップ</p>
            <p className="text-sm text-gray-400 mb-4">または</p>
            <span className="inline-block bg-blue-500 hover:bg-blue-600 text-white text-sm px-5 py-2 rounded-md pointer-events-none transition-colors">
              ファイルを選択
            </span>
            <p className="text-xs text-gray-400 mt-4">
              対応形式: JPEG, PNG, JPG（最大{MAX_SIZE_MB}MB・複数選択可）
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

          {/* プレビュー */}
          {selectedFiles.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600">{selectedFiles.length}件 選択中</p>
                <button onClick={clearAll} disabled={uploading}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                  すべて削除
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {selectedFiles.map(({ file, preview }, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg overflow-hidden shadow-sm">
                    <img src={preview} alt={file.name} className="w-full h-28 object-cover" />
                    <div className="p-2 bg-white">
                      <p className="text-xs text-gray-600 truncate font-medium">{file.name}</p>
                      <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        disabled={uploading}
                        className="mt-1.5 w-full text-xs text-red-500 border border-red-100 rounded py-0.5 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* プログレスバー */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-sm text-gray-600">{progressLabel}</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${progress}%` }}
                >
                  {progress > 15 && `${progress}%`}
                </div>
              </div>
            </div>
          )}

          {/* ボタン */}
          {selectedFiles.length > 0 && !uploading && (
            <div className="flex gap-2 pt-1 border-t border-gray-100">
              <Button variant="outline" onClick={clearAll} className="flex-1">クリア</Button>
              <Button onClick={handleSubmit} className="flex-1">
                📤 {selectedFiles.length}件の名刺をアップロード
              </Button>
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
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>名刺の画像ファイルを選択またはドラッグ＆ドロップ</li>
            <li>複数枚を一度にアップロード可能</li>
            <li>Supabase Storage に画像が保存され、OCR処理が実行されます</li>
            <li>処理完了後、名刺一覧画面で確認できます</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
