import apiClient from '@/lib/axios';

/**
 * バックエンド SignedScanUploadService::buildDownloadFilename と同じ規約でファイル名を組み立てる。
 * 例: INV-SBC-202604-001-株式会社S.B.C様-太陽光パネル設置に伴う事前調査.pdf
 * 顧客名には敬称「様」を付与。
 */
export function buildSignedScanFilename(inv: {
  invoice_number?: string | null;
  customer_name_snapshot?: string | null;
  subject_name?: string | null;
}): string {
  const sanitize = (s: string | null | undefined) =>
    (s ?? '')
      .replace(/[\/\\:*?"<>|\r\n\t]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 30);
  const customerSan = sanitize(inv.customer_name_snapshot);
  const customer = customerSan !== '' ? customerSan + '様' : '';
  const parts = [inv.invoice_number, customer, sanitize(inv.subject_name)].filter((s) => s);
  return parts.join('-') + '.pdf';
}

/**
 * 捺印スキャンPDFを Laravel proxy 経由で取得し、ファイル名付きでダウンロードする。
 * - axios の Bearer 認証を維持するため <a href> 直貼りはできず blob 経由
 * - Content-Disposition: filename*=UTF-8'' からファイル名を復元
 */
export async function downloadSignedScanPdf(
  invoiceId: number,
  onError?: (msg: string) => void,
): Promise<void> {
  try {
    const res = await apiClient.get(`/api/v1/invoices/${invoiceId}/signed-scan/download`, {
      responseType: 'blob',
    });
    const cd = res.headers['content-disposition'] as string | undefined;
    const m = cd?.match(/filename\*=UTF-8''([^;]+)/);
    const filename = m ? decodeURIComponent(m[1]) : `signed-scan-${invoiceId}.pdf`;

    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch {
    onError?.('捺印スキャンPDFの取得に失敗しました');
  }
}
