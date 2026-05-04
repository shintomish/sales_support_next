/**
 * unknown 型の catch エラーを Axios の典型レスポンス構造でナローイングする
 * 共通ヘルパー。
 *
 * 使い方:
 *   } catch (err: unknown) {
 *     const e = asApiError(err);
 *     if (e.response?.status === 401) router.push('/login');
 *     const msg = e.response?.data?.message ?? '失敗しました';
 *   }
 */
export type ApiErrorResponseData = {
  message?: string;
  errors?: Record<string, string[]>;
  log?: string;
  token_expired?: boolean;
  [key: string]: unknown;
};

export type ApiError = {
  response?: {
    status?: number;
    data?: ApiErrorResponseData;
  };
  message?: string;
};

export function asApiError(err: unknown): ApiError {
  if (err && typeof err === 'object') return err as ApiError;
  return {};
}
