const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(customParseFormat);

const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Safari 兼容的日期解析，支持 ISO、'YYYY-MM-DD HH:mm:ss' 与时间戳。
 */
function parseDate(val) {
  if (val == null || val === '') {
    return dayjs.invalid();
  }
  if (typeof val === 'number') {
    return val < 1e12 ? dayjs.unix(val) : dayjs(val);
  }
  if (val instanceof Date) {
    return dayjs(val);
  }
  if (dayjs.isDayjs(val)) {
    return val;
  }

  const str = String(val);
  if (str.indexOf('T') > -1) {
    const match = str.match(/(\d{4})-(\d{2})-(\d{2})\w(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      return dayjs(`${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`);
    }
  }

  const parsed = dayjs(str, ['YYYY-MM-DD HH:mm:ss', DATE_FORMAT], true);
  if (parsed.isValid()) {
    return parsed;
  }

  return dayjs(str.replace(/-/g, '/'));
}

/** Unix 秒时间戳 → 'YYYY-MM-DD HH:mm:ss' */
function formatTime(timestamp) {
  return parseDate(timestamp).format(DATE_TIME_FORMAT);
}

/** 日期 → 'YYYY-MM-DD'（joinStr 可自定义分隔符） */
function formatYMD(val, joinStr = '-') {
  const fmt = joinStr === '-' ? DATE_FORMAT : `YYYY${joinStr}MM${joinStr}DD`;
  return parseDate(val).format(fmt);
}

/** 日期 → 'YYYY-MM-DD  HH:mm:ss'（与 wiki 插件历史格式一致，日期与时间间双空格） */
function formatDate(val) {
  return parseDate(val).format('YYYY-MM-DD  HH:mm:ss');
}

module.exports = {
  dayjs,
  parseDate,
  formatTime,
  formatYMD,
  formatDate
};
