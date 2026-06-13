const { formatYMD, parseDate } = require('common/dayjs.js');

/**
 * 获取所需要的日期区间点
 * @param time {Number} Number是ele日期区间选择组件返回的结果
 *      Number是之前时刻距离今天的间隔天数，默认是90天
 * @param start {String} 日期对象，日期区间的开始点 '2017-01-17 00:00:00'
 * @param withToday {Boolean} 是否包含今天
 * @return {Array} ['2017-01-17 00:00:00', '2017-01-20 23:59:59']
 */
exports.getDateRange = (time = 90, start = false, withToday = true) => {
    const gapTime = time * 24 * 3600 * 1000;
    if (!start) {
        // 没有规定start时间
        let endTime = getNowMidnightDate().getTime();
        if (!withToday) {
            endTime -= 86400000;
        }
        return [formatYMD(endTime - gapTime), formatYMD(endTime - 1000)];
    }
    const startTime = parseDate(start).valueOf();
    const endTime = startTime + (gapTime - 1000);
    return [start, formatYMD(endTime)];
}

/**
 * 获取距今天之前多少天的所有时间
 *  @param time {Number} Number是ele日期区间选择组件返回的结果
 *      Number是之前时刻距离今天的间隔天数，默认是30天
 *  @return {Array} ['2017-01-17', '2017-01-28', '2017-10-29',...]
 */

exports.getDateInterval = (time = 30) => {
    // const gapTime = time * 24 * 3600 * 1000;
    // 今天
    let endTime = new Date().getTime();
    let timeList = []
    for (let i = 0; i < time; i++) {
        const gapTime = i * 24 * 3600 * 1000;
        const time = formatYMD(endTime - gapTime);
        timeList.push(time);
    }
    return timeList;
}

/**获取2017-10-27 00:00:00 和 2017-10-27 23:59:59的时间戳
 *  @param date {String}  "2017-10-27"
 *  @return {Array} [ 1509033600000, 1509119999000 ]
 */

exports.getTimeInterval = (date) => {
    const startTime = (getNowMidnightDate(date).getTime()-86400000)/1000;
    const endTime =(getNowMidnightDate(date).getTime()-1000)/1000;
    return [startTime, endTime];
}

/**
 * 获取当前时间午夜0点的日期对象
 */
const getNowMidnightDate = (time) => {
    let date;
    if (time) {
        date = new Date(time);
    } else {
        date = new Date();
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

exports.formatYMD = formatYMD;

/**
 * 获取所需的时间差值,
 * tip：new Date('2017-01-17 00:00:00')在safari下不可用，需进行替换
 * @param Array ['2017-01-17 00:00:00', '2017-01-20 23:59:59']
 * @return {Number} 3
 */
exports.getDayGapFromRange = dateRange => {
    const startTime = parseDate(dateRange[0]).valueOf();
    const endTime = parseDate(dateRange[1]).valueOf();
    return Math.ceil((endTime - startTime) / 86400000);
}

/**
 * 将内存单位从字节(b)变成GB
 */

exports.transformBytesToGB = bytes => {
  return (bytes/1024/1024/1024).toFixed(2)
}

exports.transformSecondsToDay = seconds => {
  return (seconds/3600/24).toFixed(2)
}
