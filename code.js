/**
 * 기장중학교 교사 회원 명부 쓰기 전용 웹 앱
 *
 * 대상 스프레드시트: 1_qIRbv44zWd9yv4yNzTQ0frXTvILl2-iejzPqhF8i2w
 * 대상 시트: 교사 아이디 비번
 *
 * 이 파일은 회원 명부의 추가·수정·삭제와 연결 상태 확인만 담당합니다.
 * 시간표·학사일정·급식당번 코드와 함께 사용할 필요가 없습니다.
 */

const ROSTER_SPREADSHEET_ID = '1_qIRbv44zWd9yv4yNzTQ0frXTvILl2-iejzPqhF8i2w';
const ROSTER_SHEET_NAME = '교사 아이디 비번';
const ROSTER_SECRET_PROPERTY = 'SHEET_WRITE_SECRET';

/** 스프레드시트를 열 때 상단에 시간표 캐시 관리 메뉴를 표시합니다. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('시간표 관리')
    .addItem('↻ 시간표 캐시 지금 업데이트', 'menuSyncTimetableCache_')
    .addItem('⏱ 30분 자동 업데이트 켜기', 'menuEnableTimetableTrigger_')
    .addItem('■ 30분 자동 업데이트 끄기', 'menuDisableTimetableTrigger_')
    .addSeparator()
    .addItem('ⓘ 시간표 캐시 상태 보기', 'menuShowTimetableSyncStatus_')
    .addToUi();
}

function menuSyncTimetableCache_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.toast('컴시간 원본에서 최신 시간표를 가져오는 중입니다...', '시간표 관리', 20);
  try {
    const result = syncTimetableCache();
    spreadsheet.toast(`${result.periods}개 기간, ${result.rows}개 수업 행을 시간표 캐시에 저장했습니다.`, '시간표 업데이트 완료', 10);
    SpreadsheetApp.getUi().alert('시간표 캐시 업데이트 완료', `${result.periods}개 기간의 ${result.rows}개 수업 행을 ‘시간표 캐시’ 시트에 저장했습니다.`, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    SpreadsheetApp.getUi().alert('시간표 캐시 업데이트 실패', errorMessage_(error), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function menuEnableTimetableTrigger_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.toast('30분 자동 업데이트를 설정하고 첫 동기화를 실행합니다...', '시간표 관리', 20);
  try {
    const result = createTimetableTrigger();
    SpreadsheetApp.getUi().alert('30분 자동 업데이트 설정 완료', `지금 시간표를 갱신했고, 이후 30분마다 자동 갱신합니다.\n(${result.rows}개 수업 행 저장)`, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    SpreadsheetApp.getUi().alert('자동 업데이트 설정 실패', errorMessage_(error), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function menuDisableTimetableTrigger_() {
  const count = removeTimetableTriggers_();
  SpreadsheetApp.getUi().alert('자동 업데이트 중지', `${count}개의 30분 자동 업데이트 트리거를 삭제했습니다.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuShowTimetableSyncStatus_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(TIMETABLE_SHEET_NAME);
  const rows = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  const lastSync = PropertiesService.getScriptProperties().getProperty('TIMETABLE_LAST_SYNC') || '기록 없음';
  SpreadsheetApp.getUi().alert('시간표 캐시 상태', `시간표 캐시 행 수: ${rows}\n마지막 성공 동기화: ${lastSync}\n30분 자동 갱신: ${hasTimetableTrigger_() ? '켜짐' : '꺼짐'}`, SpreadsheetApp.getUi().ButtonSet.OK);
}

function doPost(e) {
   try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(request.action || '');
    if (action === 'activityAppend') return appendActivity_(request);
    if (action === 'syncTimetableCache') return syncTimetableCacheAsAdmin_(request);
    requireSecret_(request.secret);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20 * 1000)) throw new Error('다른 회원 명부 변경 작업이 진행 중입니다. 잠시 후 다시 시도하세요.');
    try {
      if (action === 'healthCheck') return json_({ success: true, operation: 'healthCheck' });
      if (action === 'create') return createAccount_(request);
      if (action === 'update') return updateAccount_(request);
      if (action === 'delete') return deleteAccount_(request);
      throw new Error('지원하지 않는 회원 명부 요청입니다.');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json_({ success: false, error: errorMessage_(error) });
  }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function errorMessage_(error) {
  return String(error && error.message ? error.message : error);
}

function requireSecret_(providedSecret) {
  const configuredSecret = PropertiesService.getScriptProperties().getProperty(ROSTER_SECRET_PROPERTY);
  if (!configuredSecret) throw new Error('SHEET_WRITE_SECRET 스크립트 속성이 설정되지 않았습니다.');
  if (String(providedSecret || '') !== configuredSecret) throw new Error('회원 명부 쓰기 인증에 실패했습니다.');
}

function rosterSheet_() {
  const sheet = SpreadsheetApp.openById(ROSTER_SPREADSHEET_ID).getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet) throw new Error('교사 아이디 비번 시트를 찾지 못했습니다. 시트 이름을 확인하세요.');
  if (sheet.getLastRow() < 1) throw new Error('교사 아이디 비번 시트에 제목 행이 필요합니다.');
  return sheet;
}

function normalizeHeader_(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function columns_(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const normalized = headers.map(normalizeHeader_);
  const findColumn = function(labels) {
    return normalized.findIndex(function(header) { return labels.indexOf(header) >= 0; });
  };
  const serial = findColumn(['연번', '번호', 'no']);
  const loginId = findColumn(['아이디', '교사아이디']);
  const password = findColumn(['비밀번호', '비번', '패스워드']);
  const realName = findColumn(['교사실명', '실명', '성명', '교사이름']);

  if (loginId < 0 || password < 0 || realName < 0) {
    throw new Error('첫 행에 아이디, 비밀번호, 교사실명 열이 모두 필요합니다.');
  }
  return { serial: serial, loginId: loginId, password: password, realName: realName, width: headers.length };
}

function accounts_(sheet, columns) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, columns.width).getValues();
  return values.map(function(row, index) {
    return {
      rowNumber: index + 2,
      loginId: String(row[columns.loginId] || '').trim(),
      realName: String(row[columns.realName] || '').trim(),
      password: String(row[columns.password] || ''),
      serial: columns.serial < 0 ? '' : row[columns.serial],
    };
  }).filter(function(account) { return account.loginId; });
}

function validateText_(value, label, required) {
  const text = String(value || '').trim();
  if (required && !text) throw new Error(label + '을(를) 입력하세요.');
  if (text.length > 80) throw new Error(label + '은(는) 80자 이하여야 합니다.');
  return text;
}

function validatePassword_(value, required) {
  const password = String(value || '');
  if (required && !password) throw new Error('비밀번호를 입력하세요.');
  if (password && password.length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.');
  if (password.length > 128) throw new Error('비밀번호는 128자 이하여야 합니다.');
  return password;
}

function nextSerial_(accounts) {
  const numbers = accounts.map(function(account) { return Number(account.serial); }).filter(function(value) { return Number.isFinite(value); });
  return numbers.length ? Math.max.apply(null, numbers) + 1 : accounts.length + 1;
}

function createAccount_(request) {
  const loginId = validateText_(request.loginId, '교사 아이디', true);
  const realName = validateText_(request.realName, '교사 실명', true);
  const password = validatePassword_(request.password, true);
  const sheet = rosterSheet_();
  const columns = columns_(sheet);
  const accounts = accounts_(sheet, columns);
  if (accounts.some(function(account) { return account.loginId === loginId; })) throw new Error('이미 사용 중인 교사 아이디입니다.');

  const row = Array(columns.width).fill('');
  if (columns.serial >= 0) row[columns.serial] = nextSerial_(accounts);
  row[columns.loginId] = loginId;
  row[columns.password] = password;
  row[columns.realName] = realName;
  sheet.appendRow(row);
  return json_({ success: true, action: 'create', loginId: loginId });
}

function updateAccount_(request) {
  const originalLoginId = validateText_(request.originalLoginId || request.loginId, '기존 교사 아이디', true);
  const loginId = validateText_(request.loginId, '교사 아이디', true);
  const realName = validateText_(request.realName, '교사 실명', true);
  const password = validatePassword_(request.password, false);
  const sheet = rosterSheet_();
  const columns = columns_(sheet);
  const accounts = accounts_(sheet, columns);
  const existing = accounts.find(function(account) { return account.loginId === originalLoginId; });
  if (!existing) throw new Error('수정할 기존 교사 계정을 찾지 못했습니다. 새 행은 추가하지 않았습니다.');
  if (existing.loginId === '마스터') throw new Error('마스터 계정은 이 화면에서 수정할 수 없습니다.');
  if (loginId !== originalLoginId && accounts.some(function(account) { return account.loginId === loginId; })) throw new Error('이미 사용 중인 교사 아이디입니다.');

  sheet.getRange(existing.rowNumber, columns.loginId + 1).setValue(loginId);
  sheet.getRange(existing.rowNumber, columns.realName + 1).setValue(realName);
  if (password) sheet.getRange(existing.rowNumber, columns.password + 1).setValue(password);
  return json_({ success: true, action: 'update', loginId: loginId });
}

function deleteAccount_(request) {
  const loginId = validateText_(request.loginId, '교사 아이디', true);
  const sheet = rosterSheet_();
  const columns = columns_(sheet);
  const account = accounts_(sheet, columns).find(function(item) { return item.loginId === loginId; });
  if (!account) throw new Error('삭제할 기존 교사 계정을 찾지 못했습니다.');
  if (account.loginId === '마스터') throw new Error('마스터 계정은 삭제할 수 없습니다.');

  sheet.deleteRow(account.rowNumber);
  return json_({ success: true, action: 'delete', loginId: loginId });
}
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

function syncTimetableCacheAsAdmin_(request) {
  const adminId = String(request.adminId || '').trim();
  const adminPassword = String(request.adminPassword || '');
  if (adminId !== '마스터') throw new Error('마스터 계정만 시간표 캐시를 갱신할 수 있습니다.');
  const sheet = rosterSheet_();
  const columns = columns_(sheet);
  const account = accounts_(sheet, columns).find(function(item) { return item.loginId === adminId; });
  if (!account || account.password !== adminPassword) throw new Error('마스터 인증에 실패했습니다. 다시 로그인한 뒤 시도하세요.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20 * 1000)) throw new Error('다른 시간표 갱신 작업이 진행 중입니다. 잠시 후 다시 시도하세요.');
  try {
    return json_(syncTimetableCache());
  } finally {
    lock.releaseLock();
  }
}

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

function removeTimetableTriggers_() {
  let count = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncTimetableCache') {
      ScriptApp.deleteTrigger(trigger);
      count += 1;
    }
  });
  return count;
}

function hasTimetableTrigger_() {
  return ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'syncTimetableCache';
  });
}

function createTimetableTrigger() {
  removeTimetableTriggers_();
  ScriptApp.newTrigger('syncTimetableCache').timeBased().everyMinutes(30).create();
  return syncTimetableCache();
}

function testTimetableSync() {
  const result = syncTimetableCache();
  Logger.log(JSON.stringify(result));
}

function getTimetableSyncStatus() {
  return PropertiesService.getScriptProperties().getProperty('TIMETABLE_LAST_SYNC') || '아직 성공한 동기화 기록이 없습니다.';
}

const ACTIVITY_SPREADSHEET_ID = '1_qIRbv44zWd9yv4yNzTQ0frXTvILl2-iejzPqhF8i2w';
const ACTIVITY_SHEET_NAME = '학생 활동 기록';

function appendActivity_(request) {
  const loginId = String(request.loginId || '').trim();
  const password = String(request.password || '');
  const record = request.record || {};
  if (!loginId || !password) throw new Error('교사 로그인 확인 정보가 없습니다.');

  const activitySpreadsheet = SpreadsheetApp.openById(ACTIVITY_SPREADSHEET_ID);
  const roster = activitySpreadsheet.getSheetByName('교사 아이디 비번');
  if (!roster) throw new Error('교사 아이디 비번 시트를 찾지 못했습니다.');
  const values = roster.getDataRange().getDisplayValues();
  if (values.length < 2) throw new Error('교사 계정이 등록되어 있지 않습니다.');
  const headers = values[0].map(function(v) { return String(v || '').replace(/\s+/g, '').trim(); });
  const idCol = headers.findIndex(function(v) { return ['아이디','로그인','교사아이디'].indexOf(v) >= 0; });
  const pwCol = headers.findIndex(function(v) { return ['비밀번호','비번','패스워드'].indexOf(v) >= 0; });
  const nameCol = headers.findIndex(function(v) { return ['교사실명','실명','성명','교사이름'].indexOf(v) >= 0; });
  if (idCol < 0 || pwCol < 0 || nameCol < 0) throw new Error('교사 아이디 비번 시트의 헤더를 확인하세요.');
  const account = values.slice(1).map(function(row) {
    return { id: String(row[idCol] || '').trim(), password: String(row[pwCol] || ''), name: String(row[nameCol] || '').trim() };
  }).find(function(item) { return item.id === loginId && item.password === password; });
  if (!account) throw new Error('교사 로그인 확인에 실패했습니다.');

  let sheet = activitySpreadsheet.getSheetByName(ACTIVITY_SHEET_NAME);
  const header = ['기록일','교사아이디','교사실명','학년','반','번호','활동내용','비고','기록ID'];
  if (!sheet) {
    sheet = activitySpreadsheet.insertSheet(ACTIVITY_SHEET_NAME);
    sheet.appendRow(header);
  } else if (sheet.getLastRow() < 1) {
    sheet.appendRow(header);
  }

  const recordId = String(record.recordId || (new Date().getTime() + '-' + Math.random()));
  const existingIds = sheet.getLastRow() > 1 ? sheet.getRange(2, 9, sheet.getLastRow() - 1, 1).getDisplayValues().flat() : [];
  if (existingIds.indexOf(recordId) >= 0) return json_({ success: true, duplicate: true, recordId: recordId });

  sheet.appendRow([
    String(record.date || ''), account.id, account.name,
    String(record.grade || ''), String(record.cls || ''), String(record.studentNo || ''),
    String(record.content || ''), String(record.memo || ''), recordId
  ]);
  return json_({ success: true, recordId: recordId, teacherName: account.name });
}


/**
 * 2026-08-26 교사별 원본 배열(자료542) 기준 강제 재생성 함수.
 * Apps Script 함수 목록에서 이 이름을 직접 실행하면 새 파서가 적용됐는지 명확히 확인할 수 있습니다.
 */
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


/**
 * 시간표 동기화 상태를 스프레드시트 탭에 기록합니다.
 * syncTimetableCache()가 비어 보일 때 이 함수를 실행하면 원본 응답과 생성 행 수를 바로 확인할 수 있습니다.
 */
function diagnoseTimetableCache_20260826() {
  const ss = SpreadsheetApp.openById(TIMETABLE_SPREADSHEET_ID);
  const statusSheet = ss.getSheetByName('시간표 동기화 상태') || ss.insertSheet('시간표 동기화 상태');
  statusSheet.clearContents();
  statusSheet.getRange(1, 1, 1, 2).setValues([['항목', '값']]);
  const values = [
    ['실행시각', new Date()],
    ['대상 스프레드시트 ID', TIMETABLE_SPREADSHEET_ID],
    ['학교 코드', TIMETABLE_SCHOOL_CODE],
    ['파서 버전', '자료542 교사별 원본 / 2026-08-26']
  ];
  try {
    const data = fetchComciganPeriod_(1);
    if (!data) throw new Error('컴시간 원본 기간 1을 읽지 못했습니다.');
    const tables = data['자료542'] || [];
    const names = data['자료446'] || [];
    const tempRows = [['교사명', '학년', '반', '요일', '교시', '과목', '기간시작일', '교시시작', '교시종료']];
    appendTeacherRows_(tempRows, data, String(data['시작일'] || '').trim());
    values.push(['컴시간 기간 시작일', String(data['시작일'] || '')]);
    values.push(['원본 교사 수', String(Math.max(0, names.length - 1))]);
    values.push(['교사별 원본 배열 수', String(Math.max(0, tables.length - 1))]);
    values.push(['생성된 시간표 행 수', String(Math.max(0, tempRows.length - 1))]);
    values.push(['엄동현 수요일 원본', JSON.stringify((tables[24] || [])[3] || [])]);
    values.push(['판정', tempRows.length > 1 ? '정상: syncTimetableCache() 실행 시 시간표 캐시가 채워져야 합니다.' : '오류: 원본은 받았지만 시간표 행을 만들지 못했습니다.']);
  } catch (error) {
    values.push(['오류', String(error && error.message ? error.message : error)]);
  }
  statusSheet.getRange(2, 1, values.length, 2).setValues(values);
  statusSheet.autoResizeColumns(1, 2);
  return values;
}

/** 진단 후 즉시 캐시를 강제 생성하는 함수입니다. */
function diagnoseAndSyncTimetableCache_20260826() {
  diagnoseTimetableCache_20260826();
  return syncTimetableCache();
}
