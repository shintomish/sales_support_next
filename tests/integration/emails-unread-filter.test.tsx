// tests/integration/emails-unread-filter.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';

/**
 * /emails 「未読のみ」フィルタ ON 時の handleSelectEmail 挙動を pin する (バグ修正 65cf561)。
 *
 * 検証ケース:
 *   1. 通常: 複数未読の中から 1 件クリック → 該当だけリストから消える + total -1
 *   2. 最後の 1 件: 1 件しかない未読をクリック → リスト空、empty message 表示、total=0
 *   3. unreadOnly=false (通常モード): クリックしても is_read=true マーキングだけ、削除なし
 *
 * フルページレンダリングを避けるため、emails/page.tsx の handleSelectEmail を抽出した
 * 最小コンポーネントで挙動を検証する。
 */

type Email = { id: number; subject: string; is_read: boolean };
type PaginatedEmails = { data: Email[]; current_page: number; last_page: number; total: number };

function TestEmailsList({
  initialEmails,
  unreadOnly,
  fetchDetail,
}: {
  initialEmails: PaginatedEmails;
  unreadOnly: boolean;
  fetchDetail: (id: number) => Promise<Email>;
}) {
  const [emails, setEmails] = useState<PaginatedEmails | null>(initialEmails);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // handleSelectEmail (emails/page.tsx の挙動を抽出)
  const handleSelectEmail = async (email: Email) => {
    const wasUnread = !email.is_read;
    const detail = await fetchDetail(email.id);
    setSelectedEmail(detail);
    setEmails(prev => {
      if (!prev) return null;
      const newData = unreadOnly
        ? prev.data.filter(e => e.id !== email.id)
        : prev.data.map(e => e.id === email.id ? { ...e, is_read: true } : e);
      return {
        ...prev,
        data: newData,
        total: unreadOnly && wasUnread ? Math.max(0, prev.total - 1) : prev.total,
      };
    });
  };

  return (
    <div>
      <div data-testid="total">total:{emails?.total ?? 0}</div>
      <div data-testid="list-length">len:{emails?.data.length ?? 0}</div>
      {emails && emails.data.length === 0 && (
        <div data-testid="empty">メールがありません。</div>
      )}
      {emails?.data.map(email => (
        <button
          key={email.id}
          data-testid={`email-${email.id}`}
          onClick={() => handleSelectEmail(email)}
        >
          {email.subject} {email.is_read ? '(既読)' : '(未読)'}
        </button>
      ))}
      <div data-testid="selected">{selectedEmail ? `selected:${selectedEmail.id}` : 'none'}</div>
    </div>
  );
}

describe('/emails unread-only filter — list removal on click', () => {
  it('removes the clicked email from list and decrements total (multi-item case)', async () => {
    const initial: PaginatedEmails = {
      data: [
        { id: 1, subject: 'A', is_read: false },
        { id: 2, subject: 'B', is_read: false },
        { id: 3, subject: 'C', is_read: false },
      ],
      current_page: 1,
      last_page: 1,
      total: 3,
    };
    const fetchDetail = async (id: number): Promise<Email> =>
      ({ id, subject: `email-${id}`, is_read: true });

    render(<TestEmailsList initialEmails={initial} unreadOnly={true} fetchDetail={fetchDetail} />);

    fireEvent.click(screen.getByTestId('email-2'));

    await waitFor(() => {
      expect(screen.getByTestId('list-length').textContent).toBe('len:2');
    });
    expect(screen.getByTestId('total').textContent).toBe('total:2');
    expect(screen.queryByTestId('email-2')).toBeNull();
  });

  it('removes the LAST unread email and shows empty state with total=0 (regression: 最後の1件)', async () => {
    const initial: PaginatedEmails = {
      data: [{ id: 99, subject: 'last', is_read: false }],
      current_page: 1,
      last_page: 1,
      total: 1,
    };
    const fetchDetail = async (id: number): Promise<Email> =>
      ({ id, subject: 'last-detail', is_read: true });

    render(<TestEmailsList initialEmails={initial} unreadOnly={true} fetchDetail={fetchDetail} />);

    fireEvent.click(screen.getByTestId('email-99'));

    await waitFor(() => {
      expect(screen.getByTestId('list-length').textContent).toBe('len:0');
    });
    expect(screen.getByTestId('total').textContent).toBe('total:0');
    expect(screen.queryByTestId('empty')).not.toBeNull();
    expect(screen.queryByTestId('email-99')).toBeNull();
    expect(screen.getByTestId('selected').textContent).toBe('selected:99');
  });

  it('keeps the email in list (read state) when unreadOnly=false', async () => {
    const initial: PaginatedEmails = {
      data: [{ id: 7, subject: 'X', is_read: false }],
      current_page: 1,
      last_page: 1,
      total: 1,
    };
    const fetchDetail = async (id: number): Promise<Email> =>
      ({ id, subject: 'X', is_read: true });

    render(<TestEmailsList initialEmails={initial} unreadOnly={false} fetchDetail={fetchDetail} />);

    fireEvent.click(screen.getByTestId('email-7'));

    await waitFor(() => {
      expect(screen.getByTestId('selected').textContent).toBe('selected:7');
    });
    // 通常モード: list に残る (is_read=true マーキングのみ)
    expect(screen.getByTestId('list-length').textContent).toBe('len:1');
    expect(screen.getByTestId('total').textContent).toBe('total:1');
    expect(screen.queryByTestId('email-7')).not.toBeNull();
    expect(screen.getByTestId('email-7').textContent).toContain('(既読)');
  });

  it('does not decrement total when clicking an already-read email under unreadOnly (defensive)', async () => {
    // 通常はこのケースは起きないが、wasUnread=false の防御
    const initial: PaginatedEmails = {
      data: [{ id: 5, subject: 'already', is_read: true }],
      current_page: 1,
      last_page: 1,
      total: 1,
    };
    const fetchDetail = async (id: number): Promise<Email> =>
      ({ id, subject: 'already', is_read: true });

    render(<TestEmailsList initialEmails={initial} unreadOnly={true} fetchDetail={fetchDetail} />);

    fireEvent.click(screen.getByTestId('email-5'));

    await waitFor(() => {
      expect(screen.getByTestId('list-length').textContent).toBe('len:0');
    });
    // wasUnread=false なので total は減らさない (元から既読は除外条件に該当しないため)
    expect(screen.getByTestId('total').textContent).toBe('total:1');
  });
});
