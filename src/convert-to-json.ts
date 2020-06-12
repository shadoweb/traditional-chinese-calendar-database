import fs from 'fs';
import path from 'path';
import { GanZhi } from '../test/ganzhi';

const BASE_DIR = path.join(__dirname, '../database/origin');
const OUTPUT_PATH = path.join(__dirname, '../database/json');

interface DateItem {
  gregorian: {
    year: number,
    month: number,
    date: number,
  },
  lunar: {
    year: string,
    date: string,
    month: string,
    leapMonth: boolean,
  },
  day: string,
  zodiac: string,
  solarTerm: string,
}

(async function() {
  const files = (await fs.promises.readdir(BASE_DIR)).map(file => path.join(BASE_DIR, file));
  for(let file of files) {
    const content = await fs.promises.readFile(file, { encoding: 'utf-8' });

    const dates = parseOriginData(content);

    await fs.promises.writeFile(
      path.join(OUTPUT_PATH, `${ path.basename(file).split('.').slice(0, -1).join('.') }.json`),
      JSON.stringify(dates, null, 2),
      {
        encoding: 'utf-8',
      }
    );
  }

}());

function parseOriginData(content: string) {
  let dates: Array<DateItem> = new Array();
  const lines = content.split(/\n/).map(line => line.trim()).filter(line => !!line);
  let { year, chronology, zodiac } = lines[0].match(/^(?<year>(\d{4}))\((?<chronology>\S{2})\s*-\s*肖(?<zodiac>(\S{1}))/).groups;
  let lichun: boolean = false;
  let runyue: boolean = false;
  let lunarMonth: string;
  let firstLunarMonth: string;
  for(let index=2; index < lines.length - 1; index++) {
    const line = lines[index];
    try {
      let { year, month, date, lunarDate, day, solarTerm } = line.match(/(?<year>(\d{4}))年(?<month>(\d{1,2}))月(?<date>(\d{1,2}))日\s+(?<lunarDate>(\S+))\s+(?<day>(\S+))(\s+)?(?<solarTerm>(\S+))?/).groups;
      month = month.replace(/^0*/, '');
      date = date.replace(/^0*/, '');
      if(solarTerm === '立春') {
        lichun = true;
      }
      if(/^(?!閏)\S+月$/.test(lunarDate)) {
        lunarMonth = lunarDate;
        lunarDate = '初一';
        runyue = false;
        firstLunarMonth || (firstLunarMonth = lunarMonth);
      }
      if(/^閏\S+月$/.test(lunarDate)) {
        lunarMonth = lunarDate;
        lunarDate = '初一';
        runyue = true;
        firstLunarMonth || (firstLunarMonth = lunarMonth);
      }
      dates.push({
        day: day,
        gregorian: {
          year: Number.parseInt(year),
          month: Number.parseInt(month),
          date: Number.parseInt(date),
        },
        lunar: {
          year: lichun ? chronology : GanZhi.prev(chronology),
          month: lunarMonth,
          date: lunarDate,
          leapMonth: runyue,
        },
        solarTerm: solarTerm,
        zodiac: lichun ? zodiac : GanZhi.prevZodiac(zodiac),
      });
    } catch(err) {
      console.log(line);
      console.error(err);
      process.exit(1);
    }
  }

  const missingLunarMonth = GanZhi.prevMonth(firstLunarMonth)
  dates = dates.map(item => {
    if(item.lunar.month) {
      return item;
    } else {
      item.lunar.month = missingLunarMonth;
      return item;
    }
  });

  return dates;
}
