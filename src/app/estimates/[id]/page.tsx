'use client';

// 見積書詳細ページ。実体は /invoices/[id] のコンポーネントを流用しているが、
// doc_type に応じてタイトル/戻り先/削除確認文言が切り替わる。
// URL を /estimates/[id] に分けることでブックマークやリストリンクが意味的に正しくなる。
import InvoiceDetailPage from '@/app/invoices/[id]/page';

export default InvoiceDetailPage;
