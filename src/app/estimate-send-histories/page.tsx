'use client';

import SendHistoryList from '@/components/SendHistoryList';

export default function EstimateSendHistoriesPage() {
  return <SendHistoryList docType="estimate" title="見積書送信履歴" basePath="/estimates" />;
}
