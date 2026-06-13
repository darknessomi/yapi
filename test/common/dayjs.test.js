import { describe, it, expect } from 'vitest';
import { formatTime, formatYMD, formatDate, parseDate } from '../../common/dayjs.js';

describe('dayjs helpers', () => {
  it('formatTime from unix seconds', () => {
    const ts = Math.floor(new Date(2017, 0, 18, 16, 0, 0).getTime() / 1000);
    expect(formatTime(ts)).toBe('2017-01-18 16:00:00');
  });

  it('formatYMD with default separator', () => {
    const ts = Math.floor(new Date(2017, 0, 18, 16, 0, 0).getTime() / 1000);
    expect(formatYMD(ts)).toBe('2017-01-18');
    expect(formatYMD('2017-01-17 00:00:00')).toBe('2017-01-17');
  });

  it('formatYMD with custom separator', () => {
    const ts = Math.floor(new Date(2017, 0, 18, 16, 0, 0).getTime() / 1000);
    expect(formatYMD(ts, '/')).toBe('2017/01/18');
  });

  it('formatDate', () => {
    const ts = Math.floor(new Date(2017, 0, 18, 16, 0, 0).getTime() / 1000);
    expect(formatDate(ts)).toBe('2017-01-18  16:00:00');
  });

  it('parseDate handles ISO string', () => {
    const ts = parseDate('2017-04-19T11:01:19.074+0800').valueOf();
    expect(ts).toBe(new Date(2017, 3, 19, 11, 1, 19).getTime());
  });

  it('parseDate handles space-separated datetime', () => {
    expect(parseDate('2017-01-17 00:00:00').format('YYYY-MM-DD')).toBe('2017-01-17');
  });
});
