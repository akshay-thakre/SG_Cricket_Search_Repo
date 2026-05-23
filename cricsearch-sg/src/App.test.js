import { render, screen } from '@testing-library/react';
import CricSearchApp from './App';

// Mock fetch so health check doesn't hit the network during tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: 'ok' }),
  })
);

afterEach(() => {
  jest.clearAllMocks();
});

test('renders the app title heading', () => {
  render(<CricSearchApp />);
  const heading = screen.getByRole('heading', { level: 1 });
  expect(heading).toHaveTextContent(/CricSearch SG/i);
});

test('renders the search input', () => {
  render(<CricSearchApp />);
  expect(screen.getByPlaceholderText(/Enter player name/i)).toBeInTheDocument();
});

test('shows API status chip text in the page', () => {
  const { container } = render(<CricSearchApp />);
  // The status chip shows Checking... / API Online / API Offline
  // Use textContent because the chip has a mixed ● + text structure
  expect(container.textContent).toMatch(/Checking\.\.\.|API Online|API Offline/);
});
