'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SelectedFile = {
  file: File;
  preview: string;
};

const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_SIZE_MB = 10;

export default function BusinessCardCreatePage() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ★ ファイルバリデーション＋プレビューURL生成
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
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = ''; // ★ 同じファイルを再選択できるようリセット
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      URL.revokeObjectURL(prev[index].preview); // ★ メモリリーク防止
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAll = () => {
    selectedFiles.forEach(f => URL.revokeObjectURL(f.preview));
    setSelectedFiles([]);
    setError(null);
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      setError('ファイルを選択してください');
      return;
    }

    setUploading(true);
    setProgress(0);
    setProgressLabel('アップロード中...');
    setError(null);

    const formData = new FormData();
    selectedFiles.forEach(({ file }) => formData.append('images[]', file));

    try {
      // ★ XHRでプログレス取得（axiosのonUploadProgressを使用）
      await apiClient.post('/api/v1/cards', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
            setProgressLabel(pct < 100 ? `アップロード中... ${pct}%` : 'OCR処理中... しばらくお待ちください');
          }
        },
      });

      selectedFiles.forEach(f => URL.revokeObjectURL(f.preview));
      router.push('/business-cards');

    } catch (err: any) {
      const messages: string[] = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat() as string[]
        : ['アップロードに失敗しました'];
      setError(messages.join(' / '));
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.back()}>
          ← 戻る
        </Button>
        <h1 className="text-2xl font-bold">名刺アップロード</h1>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">名刺画像を選択</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          {/* ★ D&Dエリア */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
              ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
          >
            <div className="text-4xl mb-3">☁️</div>
            <p className="font-semibold mb-1">ここに名刺画像をドラッグ＆ドロップ</p>
            <p className="text-sm text-gray-500 mb-3">または</p>
            <span className="inline-block bg-blue-500 text-white text-sm px-4 py-2 rounded-md pointer-events-none">
              ファイルを選択
            </span>
            <p className="text-xs text-gray-400 mt-3">
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

          {/* ★ プレビュー */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {selectedFiles.map(({ file, preview }, i) => (
                <div key={i} className="border rounded-lg overflow-hidden">
                  <img src={preview} alt={file.name} className="w-full h-28 object-cover" />
                  <div className="p-2">
                    <p className="text-xs text-gray-500 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      disabled={uploading}
                      className="mt-1 w-full text-xs text-red-500 border border-red-200 rounded py-0.5 hover:bg-red-50 disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ★ プログレスバー */}
          {uploading && (
            <div className="space-y-1">
              <p className="text-sm text-center text-gray-600">{progressLabel}</p>
              <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white"
                  style={{ width: `${progress}%` }}
                >
                  {progress > 10 && `${progress}%`}
                </div>
              </div>
            </div>
          )}

          {/* ★ ボタン */}
          {selectedFiles.length > 0 && !uploading && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearAll} className="flex-1">
                クリア
              </Button>
              <Button onClick={handleSubmit} className="flex-1">
                {selectedFiles.length}件の名刺をアップロード
              </Button>
            </div>
          )}

        </CardContent>
      </Card>

      {/* ★ 使い方ガイド */}
      <Card>
        <CardHeader><CardTitle className="text-base">💡 使い方</CardTitle></CardHeader>
        <CardContent>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>名刺の画像ファイルを選択またはドラッグ＆ドロップ</li>
            <li>複数枚を一度にアップロード可能</li>
            <li>自動的にOCR処理が実行され、顧客・担当者が登録されます</li>
            <li>処理完了後、名刺一覧画面で確認できます</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
