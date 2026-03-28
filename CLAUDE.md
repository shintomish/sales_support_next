# 営業支援システム - Next.js フロントエンド

## プロジェクト概要
SES企業向け営業支援システムのフロントエンド。Next.js 15 + TypeScript + Supabase Auth。

## 環境構成
| 環境 | URL |
|------|-----|
| ローカル | http://localhost:3000 |
| 本番（Vercel） | https://app.ai-mon.net |
| API（ローカル） | http://localhost:8090 |
| API（本番） | https://sales.ai-mon.net |

## 技術スタック
- Next.js 15, TypeScript
- Tailwind CSS, shadcn/ui
- Supabase Auth（ES256 JWT）
- Supabase Realtime
- Zustand（authStore）
- Vercel（自動デプロイ）

## よく使うコマンド

### 開発サーバー起動
```bash
cd ~/sales_support_next
npm run dev
```

### ビルドエラー時
```bash
rm -rf .next
npm run dev
```

### パッケージ追加後
```bash
npm install
```

## デプロイ手順
```bash
cd ~/sales_support_next
git add .
git commit -m "feat: ..."
git push origin main
# → Vercel自動デプロイ
```

## 重要な注意事項

### WSL2環境
Turbopackがファイル変更を検知できない場合：
```bash
# .env.localに追加
WATCHPACK_POLLING=true
```

### 環境変数（.env.local）
```env
NEXT_PUBLIC_API_URL=http://localhost:8090
NEXT_PUBLIC_SUPABASE_URL=https://smzoqpvaxznqcwrsgjju.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

### Supabaseクライアント
複数インスタンス作成禁止。必ず共通クライアントを使用：
```typescript
import { supabase } from '@/lib/supabase'
```

### 認証フロー
1. Supabase Authでログイン → JWT取得
2. axios.tsのインターセプターでJWTをAuthorizationヘッダーに付与
3. LaravelのSupabaseAuthミドルウェアがJWT検証

## 主要ファイル構成
```
src/
├── app/
│   ├── dashboard/          ダッシュボード
│   ├── customers/          顧客管理
│   ├── contacts/           担当者管理
│   ├── deals/              商談管理
│   ├── ses-contracts/      SES台帳
│   ├── activities/         活動履歴
│   ├── tasks/              タスク管理
│   ├── business-cards/     名刺管理
│   ├── emails/             メール管理
│   └── login/              ログイン
├── components/
│   ├── Sidebar.tsx         サイドメニュー（未読バッジ）
│   └── NotificationToast.tsx
├── hooks/
│   ├── useNotifications.ts
│   └── useUnreadEmailCount.ts  メール未読数（Realtime）
├── lib/
│   ├── axios.ts            APIクライアント
│   └── supabase.ts         Supabaseクライアント（共通）
└── store/
    └── authStore.ts        Zustand認証ストア
```

## Supabase Realtime
以下のテーブルがRealtime有効：
- `emails`（未読バッジ・自動反映）
- `tasks`（期限通知）
- `deals`、`activities`、`business_cards`

カスタムイベント：
- `emails:mark-all-read` → 全て既読後にバッジ即時更新

## テストユーザー
| メール | パスワード | ロール |
|--------|-----------|--------|
| shintomi.sh@gmail.com | password | super_admin |
| suzuki.k@izen-solution.jp | password | tenant_admin |
| sato.m@izen-solution.jp | password | tenant_user |
