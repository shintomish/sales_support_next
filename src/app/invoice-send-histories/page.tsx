'use client';

import SendHistoryList from '@/components/SendHistoryList';

export default function InvoiceSendHistoriesPage() {
  return <SendHistoryList docType="invoice" title="請求書送信履歴" basePath="/invoices" />;
}
