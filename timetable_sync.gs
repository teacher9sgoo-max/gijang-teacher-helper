/**
 * 기장중학교 컴시간 시간표 자동 동기화
 *
 * 컴시간 원본 -> 구글 시트 '시간표 캐시'
 * 학교코드: 75378
 *
 * 사용 방법
 * 1. 기존 회원 명부 Apps Script 프로젝트에 이 코드를 추가합니다.
 * 2. syncTimetableCache()를 한 번 실행해 권한을 승인합니다.
 * 3. createTimetableTrigger()를 한 번 실행하면 30분마다 자동 갱신됩니다.
 */

const TIMETABLE_SPREADSHEET_ID = '1_qIRbv44zWd9yv4yNzTQ0frXTvILl2-iejzPqhF8i2w';
const TIMETABLE_SHEET_NAME = '시간표 캐시';
const TIMETABLE_SCHOOL_CODE = '75378';
const TIMETABLE_API_PREFIX = '73629_';
const TIMETABLE_API_PATH = 'http://comci.net:4082/36179_T?';
const TIMETABLE_WEEKDAYS = ['월', '화', '수', '목', '금'];

function syncTimetableCache() {
  const spreadsheet = SpreadsheetApp.openById(TIMETABLE_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(TIMETABLE_SHEET_NAME) || spreadsheet.insertSheet(TIMETABLE_SHEET_NAME);
  const rows = [['교사명', '학년', '반', '요일', '교시', '과목', '기간시작일', '교시시작', '교시종료']];
  const seenPeriods = {};

  // 컴시간의 일자자료에는 현재 공개된 주차 목록이 들어 있습니다.
  // 최대 20개까지 조회하고, 같은 시작일은 중복 제거합니다.
  for (let period = 1; period <= 20; period += 1) {
    const data = fetchComciganPeriod_(period);
    if (!data) continue;
    const startDate = String(data['시작일'] || '').trim();
    if (!startDate || seenPeriods[startDate]) continue;
    seenPeriods[startDate] = true;
          appendTeacherRows_(rows, data, startDate);
  }

  // 원본 서버가 일시적으로 실패하면 기존 정상 캐시를 보존합니다.
  if (Object.keys(seenPeriods).length === 0 || rows.length <= 1) {
    throw new Error('컴시간 원본에서 기간별 시간표를 하나도 받지 못했습니다. 기존 캐시는 보존했습니다.');
  }

  // 수집이 성공한 경우에만 시간표 캐시를 최신 스냅샷으로 교체합니다.
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  if (rows.length > 1) sheet.getRange(2, 7, rows.length - 1, 1).setNumberFormat('@');
  PropertiesService.getScriptProperties().setProperty('TIMETABLE_LAST_SYNC', new Date().toISOString());
  return { success: true, periods: Object.keys(seenPeriods).length, rows: rows.length - 1, syncedAt: new Date().toISOString() };
}

function fetchComciganPeriod_(period) {
  const tokenText = TIMETABLE_API_PREFIX + TIMETABLE_SCHOOL_CODE + '_0_' + period;
  const token = Utilities.base64Encode(tokenText, Utilities.Charset.UTF_8);
  const response = UrlFetchApp.fetch(TIMETABLE_API_PATH + token, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (response.getResponseCode() !== 200) return null;
  const text = response.getContentText('UTF-8');
  const end = text.lastIndexOf('}');
  if (end < 0) return null;
  try {
    return JSON.parse(text.substring(0, end + 1));
  } catch (error) {
    return null;
  }
}

function appendTeacherRows_(rows, data, startDate) {
  const teachers = data['자료446'] || [];
  const subjects = data['자료492'] || [];
  const teacherTables = data['자료542'] || [];
  const split = Number(data['분리'] || 1000);
  const classTimes = data['일과시간'] || [];

  // 자료542가 컴시간 교사 화면과 동일한 교사별 배열입니다.
  // 각 교사 배열은 [주간 수업 수, 월 배열, 화 배열, 수 배열, 목 배열, 금 배열]이며,
  // 각 요일 배열의 0번 값은 해당 요일의 교시 수, 1번부터 실제 교시 코드입니다.
  for (let teacherIndex = 1; teacherIndex < teacherTables.length; teacherIndex += 1) {
    const maskedName = String(teachers[teacherIndex] || '').trim();
    const teacherTable = teacherTables[teacherIndex];
    if (!maskedName || !Array.isArray(teacherTable)) continue;
    const teacherName = teacherIndex + '-' + maskedName.replace(/^\d+[-.)]?\s*/, '');

    for (let weekday = 1; weekday <= 5; weekday += 1) {
      const dayTable = teacherTable[weekday];
      if (!Array.isArray(dayTable)) continue;
      for (let period = 1; period <= 7; period += 1) {
        const raw = dayTable[period];
        const code = Number(String(raw == null ? 0 : raw).replace(/^>/, ''));
        if (!code) continue;

        // 자료542 코드: 과목번호 * 1000 + 학급코드(예: 21*1000+301 = 21301).
        const classCode = code % split;
        const subjectIndex = Math.floor(code / split);
        const grade = Math.floor(classCode / 100);
        const classNumber = classCode % 100;
        const subject = String(subjects[subjectIndex] || '').trim();
        if (!grade || !classNumber || !subject) continue;

        const startTime = extractClassTime_(classTimes[period - 1]);
        const endTime = addMinutes_(startTime, 45);
        rows.push([
          teacherName,
          grade + '학년',
          classNumber + '반',
          TIMETABLE_WEEKDAYS[weekday - 1],
          period,
          subject,
          startDate,
          startTime,
          endTime
        ]);
      }
    }
  }
}

function extractClassTime_(value) {
  const match = String(value || '').match(/(\d{1,2}:\d{2})/);
  return match ? match[1] : '';
}

function addMinutes_(time, minutes) {
  if (!time) return '';
  const parts = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, parts[0], parts[1] + minutes);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm');
}

function createTimetableTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncTimetableCache') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('syncTimetableCache').timeBased().everyMinutes(30).create();
  syncTimetableCache();
}

function testTimetableSync() {
  const result = syncTimetableCache();
  Logger.log(JSON.stringify(result));
}

function getTimetableSyncStatus() {
  return PropertiesService.getScriptProperties().getProperty('TIMETABLE_LAST_SYNC') || '아직 성공한 동기화 기록이 없습니다.';
}


/** 자료542 교사별 원본 배열을 사용하는 최신 강제 재생성 함수입니다. */
function rebuildTimetableCacheFromTeacherTable_20260826() {
  const result = syncTimetableCache();
  PropertiesService.getScriptProperties().setProperty('TIMETABLE_PARSER_VERSION', 'teacherTables_자료542_2026-08-26');
  Logger.log('시간표 캐시 재생성 완료: 자료542 교사별 원본 파서 적용 / ' + JSON.stringify(result));
  return result;
}

function verifyUmDongHyunWednesday_20260826() {
  const data = fetchComciganPeriod_(1);
  if (!data) throw new Error('컴시간 원본을 읽지 못했습니다.');
  const teacherTable = (data['자료542'] || [])[24];
  const wednesday = teacherTable && teacherTable[3];
  Logger.log('엄동현(24) 수요일 원본 배열: ' + JSON.stringify(wednesday));
  return wednesday;
}
