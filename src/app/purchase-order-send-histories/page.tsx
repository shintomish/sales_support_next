'use client';

import SendHistoryList from '@/components/SendHistoryList';

export default function PurchaseOrderSendHistoriesPage() {
  return <SendHistoryList docType="purchase_order" title="注文書送信履歴" basePath="/purchase-orders" />;
}
