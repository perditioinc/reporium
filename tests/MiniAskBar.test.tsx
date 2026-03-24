/** @jest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MiniAskBar } from '@/components/MiniAskBar';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('MiniAskBar', () => {
  beforeEach(() => {
    push.mockReset();
  });

  test('renders input and navigates to ask page on submit', () => {
    render(<MiniAskBar />);

    fireEvent.change(screen.getByPlaceholderText('Ask a question about AI dev tools...'), {
      target: { value: 'best eval frameworks' },
    });
    fireEvent.click(screen.getByText('Ask'));

    expect(push).toHaveBeenCalledWith('/ask?q=best%20eval%20frameworks');
  });
});
