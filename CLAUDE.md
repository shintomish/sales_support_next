# CLAUDE.md - sales_support_next（Next.js フロントエンド）

## プロジェクト概要
SES企業向け営業支援システムのフロントエンド。
Next.js 15 + Supabase Auth + Vercel構成。

## 技術スタック
- Next.js 15 / TypeScript
- Tailwind CSS / shadcn/ui
- Supabase Auth（ES256 JWT）
- Zustand（authStore）
- Supabase Realtime（tasks/deals/activities/business_cards）
- Vercel（本番自動デプロイ）

## ローカル起動
```bash
cd ~/sales_support_next
npm run dev
# フロント: http://localhost:3000
# ※ WSL2環境ではWATCHPACK_POLLING=true が .env.local に必要
```

## 環境変数（.env.local）
```
NEXT_PUBLIC_API_URL=http://localhost:8090
NEXT_PUBLIC_SUPABASE_URL=https://smzoqpvaxznqcwrsgjju.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
WATCHPACK_POLLING=true
```

## 重要な注意点
- ルートファイルは必ずpage.tsxという名前にする
- Supabase Storage直接アップロードはRLS違反→Laravel経由でservice_roleキー使用
- レガシー画像パス: startsWith('http')で判定してURL切り替え
- Realtimeループ防止: UPDATEイベント購読しない（DB書き込み→UPDATE→無限ループ）
- 未読バッジリセットはカスタムDOMイベント(emails:mark-all-read)で対応

## ディレクトリ構成
```
src/
├── app/
│   ├── dashboard/
│   ├── customers/
│   ├── contacts/
│   ├── deals/
│   ├── activities/
│   ├── tasks/
│   ├── business-cards/
│   └── emails/
├── lib/         # axios.ts, supabase.ts
├── store/       # authStore.ts（Zustand）
├── components/  # Sidebar, RealtimeToast等
└── hooks/       # useRealtimeNotifications
```

## 本番デプロイ
```bash
git push origin main
# → Vercel自動デプロイ
```

## 長期記憶の参照方法
過去のセッションで議論した設計判断・トラブル対応は以下で検索できる:
```bash
cd ~/memory_engine
uv run python search_memory.py "検索したい内容" --project sales_support_next
```
