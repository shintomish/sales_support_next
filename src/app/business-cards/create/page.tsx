'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BusinessCardCreatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError('');
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('画像を選択してください');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await apiClient.post('/api/v1/cards', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // 登録結果を表示してから一覧へ
      const { registration } = res.data;
      const isNew = registration.customer.is_new ? '新規顧客' : '既存顧客';
      alert(`登録完了！\n会社: ${registration.customer.name}（${isNew}）\n担当者: ${registration.contact.name}`);

      router.push('/business-cards');
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'アップロードに失敗しました';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.push('/business-cards')}>
          ← 戻る
        </Button>
        <h1 className="text-2xl font-bold">名刺アップロード</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-600">
            名刺画像をアップロードすると、OCRで自動読み取りします
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* 画像選択エリア */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {preview ? (
              <img src={preview} alt="プレビュー" className="max-h-64 mx-auto rounded" />
            ) : (
              <div className="space-y-2 text-gray-500">
                <p className="text-4xl">📷</p>
                <p className="font-medium">クリックして画像を選択</p>
                <p className="text-sm">JPEG・PNG（最大10MB）</p>
              </div>
            )}
            <input
              id="file-input"
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* ファイル名表示 */}
          {file && (
            <p className="text-sm text-gray-600 text-center">
              選択中: {file.name}
            </p>
          )}

          {/* エラー */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* ボタン */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!file || uploading}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span> OCR処理中...
              </span>
            ) : (
              'アップロード・OCR実行'
            )}
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}
