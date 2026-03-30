# テナント別メニュー表示制御 対応まとめ

## 概要

テナントごとに「SES台帳」サイドメニューの表示/非表示を切り替える機能を実装。
`tenants` テーブルに `ses_enabled` フラグを追加し、フロントエンドでフィルタリングする方式。

---

## 実装内容

### バックエンド（sales_support）

#### 1. マイグレーション
**ファイル:** `database/migrations/2026_03_23_170426_add_ses_enabled_to_tenants_table.php`

```php
// up()
Schema::table('tenants', function (Blueprint $table) {
    $table->boolean('ses_enabled')->default(false)->after('plan');
});

// down()
Schema::table('tenants', function (Blueprint $table) {
    $table->dropColumn('ses_enabled');
});
```

#### 2. Tenantモデル
**ファイル:** `app/Models/Tenant.php`

```php
protected $fillable = ['name', 'slug', 'plan', 'is_active', 'ses_enabled'];

protected $casts = [
    'ses_enabled' => 'boolean',
];
```

#### 3. APIレスポンス
`GET /api/v1/me` および `POST /api/v1/login` はテナント全体を返す実装のため、
モデル更新のみで `ses_enabled` が自動的にレスポンスに含まれる。

---

### フロントエンド（sales_support_next）

#### 1. 型定義の更新
**ファイル:** `src/store/authStore.ts`

```ts
tenant?: {
  id: number;
  name: string;
  slug: string;
  plan: string;
  ses_enabled: boolean;  // 追加
};
```

#### 2. サイドバーのフィルタリング
**ファイル:** `src/components/Sidebar.tsx`

```ts
const allMenuItems = [
  ...
  { label: 'SES台帳', path: '/ses-contracts', icon: '📋', badge: 0, sesOnly: true },
  ...
];

const menuItems = allMenuItems.filter(
  (item) => !item.sesOnly || user?.tenant?.ses_enabled
);
```

---

## DB設定

| tenant_id | テナント名                   | ses_enabled |
|-----------|------------------------------|-------------|
| 1         | 株式会社アイゼン・ソリューション | `true`      |
| 2         | 東和商事株式会社              | `false`     |
| 3         | 株式会社ネクストステージ       | `false`     |

テナントID=1 のみ `ses_enabled = true` に設定済み（本番・ローカル両方）。

---

## 動作確認

- テナントID=1 のユーザー → SES台帳メニュー **表示**
- テナントID=2, 3 のユーザー → SES台帳メニュー **非表示**

---

## 新規テナントへの有効化方法

```sql
UPDATE tenants SET ses_enabled = true WHERE id = {tenant_id};
```

または Tinker で：

```bash
docker exec sales_support_app php artisan tinker
>>> DB::table('tenants')->where('id', {tenant_id})->update(['ses_enabled' => true]);
```
