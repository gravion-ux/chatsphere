import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConversationList from '../src/components/ConversationList';

const conversations = [
  {
    id: 'c1',
    isGroup: false,
    name: '',
    members: [
      { id: 'me', name: 'Me' },
      { id: 'bob', name: 'Bob' },
    ],
    lastMessage: { id: 'm1', body: 'See you at 5', sender: 'bob', createdAt: new Date().toISOString() },
    unreadCount: 3,
  },
  {
    id: 'c2',
    isGroup: true,
    name: 'Weekend Plans',
    members: [
      { id: 'me', name: 'Me' },
      { id: 'bob', name: 'Bob' },
      { id: 'carol', name: 'Carol' },
    ],
    lastMessage: null,
    unreadCount: 0,
  },
];

describe('ConversationList (smoke)', () => {
  test('renders titles, previews and unread badges', () => {
    render(
      <ConversationList
        conversations={conversations}
        currentUserId="me"
        activeId="c1"
        onSelect={() => {}}
        onlineUserIds={['bob']}
      />
    );
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Weekend Plans')).toBeInTheDocument();
    expect(screen.getByText('See you at 5')).toBeInTheDocument();
    expect(screen.getByTestId('unread-c1')).toHaveTextContent('3');
    expect(screen.queryByTestId('unread-c2')).not.toBeInTheDocument();
    expect(screen.getByTestId('presence-c1').className).toContain('online');
  });

  test('clicking a conversation selects it', () => {
    const onSelect = vi.fn();
    render(
      <ConversationList
        conversations={conversations}
        currentUserId="me"
        activeId={null}
        onSelect={onSelect}
        onlineUserIds={[]}
      />
    );
    fireEvent.click(screen.getByText('Weekend Plans'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }));
  });

  test('empty state renders a hint', () => {
    render(
      <ConversationList
        conversations={[]}
        currentUserId="me"
        activeId={null}
        onSelect={() => {}}
        onlineUserIds={[]}
      />
    );
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
  });
});
