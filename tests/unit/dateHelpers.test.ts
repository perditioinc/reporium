function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.floor(diffDays / 30);
  if (diffDays < 365) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe('date formatting', () => {
  it('returns today for 0 days ago', () => {
    expect(relativeTime(daysAgo(0))).toBe('today');
  });
  it('1 day not 1 days', () => {
    expect(relativeTime(daysAgo(1))).toBe('1 day ago');
  });
  it('1 month not 1 months', () => {
    expect(relativeTime(daysAgo(30))).toBe('1 month ago');
  });
  it('1 year not 1 years', () => {
    expect(relativeTime(daysAgo(365))).toBe('1 year ago');
  });
  it('2 years plural', () => {
    expect(relativeTime(daysAgo(730))).toBe('2 years ago');
  });
  it('3 months plural', () => {
    expect(relativeTime(daysAgo(90))).toBe('3 months ago');
  });
});
