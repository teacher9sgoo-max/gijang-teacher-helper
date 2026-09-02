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
const CODE_VERSION = '2026-09-02-batch-read-v1';
const ROSTER_SHEET_NAME = '교사 아이디 비번';
const TEACHER_PERMISSION_SHEET_NAME = '교사 권한 관리';
const ROSTER_SECRET_PROPERTY = 'SHEET_WRITE_SECRET';

/** 스프레드시트를 열 때 상단에 시간표 캐시 관리 메뉴를 표시합니다. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🗓️ 시간표 관리')
    .addItem('🔄 시간표 캐시 지금 업데이트', 'menuSyncTimetableCache_')
    .addItem('⏱️ 30분 자동 업데이트 켜기', 'menuEnableTimetableTrigger_')
    .addItem('⏹️ 30분 자동 업데이트 끄기', 'menuDisableTimetableTrigger_')
    .addSeparator()
    .addItem('ⓘ 시간표 캐시 상태 보기', 'menuShowTimetableSyncStatus_')
    .addToUi();
  SpreadsheetApp.getUi()
    .createMenu('🍱 조별 당번표 관리')
    .addItem('▦ 조별 반복 당번표 만들기', 'createWeeklyDutyRotationSheet')
    .addItem('↻ 이번 주 조 상태 업데이트', 'updateWeeklyDutyRotationStatus')
    .addItem('ⓘ 이번 주 당번 확인', 'showWeeklyDutyRotationStatus')
    .addToUi();
  SpreadsheetApp.getUi()
    .createMenu('👥 회원 명부 관리')
    .addItem('교사 권한 관리 시트 만들기·동기화', 'setupTeacherPermissionColumns')
    .addItem('권한 열 자동 만들기', 'setupTeacherPermissionColumns')
    .addToUi();
  SpreadsheetApp.getUi()
    .createMenu('📋 명렬표 관리')
    .addItem('📤 학년별 명렬표 엑셀 업로드', 'menuUploadRosterExcel_')
    .addItem('🔄 전체 명렬표 다시 만들기', 'rebuildAllRosterSheet_')
    .addToUi();
  SpreadsheetApp.getUi()
    .createMenu('🔗 사이트 설정 관리')
    .addItem('🆕 사이트 설정 시트 만들기', 'menuCreateSiteConfigSheet_')
    .addToUi();
}

function menuCreateSiteConfigSheet_() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = siteConfigSheet_();
    writeSiteConfigToSheet_(readSiteConfig_()); // 항목 이름을 항상 최신 한글 라벨로 맞춰줍니다.
    SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
    ui.alert('사이트 설정 시트 준비 완료', `'${SITE_CONFIG_SHEET_NAME}' 시트를 확인·정리했습니다. '주소/값' 칸을 직접 고치면 웹앱에 바로 반영됩니다.\n\n'시트 주소' 칸은 전체 링크를 그대로 붙여넣으셔도 됩니다.`, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('오류', errorMessage_(error), ui.ButtonSet.OK);
  }
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

const SITE_CONFIG_PROPERTY = 'GIJANG_SITE_CONFIG_V1';
const SITE_CONFIG_DEFAULTS = {
  sheetId: ROSTER_SPREADSHEET_ID,
  writeApiUrl: 'https://script.google.com/macros/s/AKfycbxGOJ4oPC2W1qqcger47LhvgDFhVuLLCBxoottOvT09pwp3-wyA91i6Yustckm7IG1Z/exec',
  timetableOfficialUrl: 'http://comci.net:4082/th',
  timetableServerUrl: '',
  windowsInstallerUrl: 'https://github.com/teacher9sgoo-max/gijang-teacher-helper/releases/latest',
  schoolCode: '75378'
};

function configuredSpreadsheetId_() {
  const value = readSiteConfig_().sheetId;
  if (/^[A-Za-z0-9_-]{20,}$/.test(String(value || ''))) return String(value);
  return ROSTER_SPREADSHEET_ID;
}

// '사이트 설정' 시트는 항상 고정된(ROSTER_SPREADSHEET_ID) 스프레드시트 안에 둡니다.
// 그래야 설정값 자체가 잘못돼도(예: sheetId를 엉뚱하게 저장) 설정 시트를 계속 찾아서 고칠 수 있습니다.
const SITE_CONFIG_SHEET_NAME = '사이트 설정';
const SITE_CONFIG_FIELDS = [
  { key: 'sheetId', label: '시트 주소(구글 스프레드시트 링크)' },
  { key: 'writeApiUrl', label: '앱스크립트 주소(웹앱 /exec 링크)' },
  { key: 'timetableOfficialUrl', label: '시간표 공식 사이트 주소' },
  { key: 'timetableServerUrl', label: '시간표 서버 주소(선택 사항)' },
  { key: 'windowsInstallerUrl', label: '설치파일 다운로드 주소' },
  { key: 'schoolCode', label: '학교 코드' }
];
const SITE_CONFIG_KEYS = SITE_CONFIG_FIELDS.map(function(f) { return f.key; });

function siteConfigFieldLabel_(key) {
  const found = SITE_CONFIG_FIELDS.filter(function(f) { return f.key === key; })[0];
  return found ? found.label : key;
}

// 시트의 A열에는 한글 라벨이 적히지만, 예전 버전(영문 키)으로 저장된 셀도 계속 인식합니다.
function siteConfigKeyFromCell_(cellText) {
  const text = String(cellText || '').trim();
  const byLabel = SITE_CONFIG_FIELDS.filter(function(f) { return f.label === text; })[0];
  if (byLabel) return byLabel.key;
  const byKey = SITE_CONFIG_FIELDS.filter(function(f) { return f.key === text; })[0];
  return byKey ? byKey.key : '';
}

// '시트 주소' 칸은 전체 링크를 그대로 붙여넣어도 되고, ID만 적어도 됩니다.
function extractSheetId_(value) {
  const text = String(value || '').trim();
  const matched = text.match(/\/d\/([A-Za-z0-9_-]{20,})/);
  if (matched) return matched[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return text;
  return '';
}

function siteConfigSheet_() {
  const spreadsheet = SpreadsheetApp.openById(ROSTER_SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SITE_CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SITE_CONFIG_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['항목', '주소/값']]).setFontWeight('bold');
    const seedRows = SITE_CONFIG_FIELDS.map(function(f) {
      const value = f.key === 'sheetId'
        ? ('https://docs.google.com/spreadsheets/d/' + ROSTER_SPREADSHEET_ID + '/edit')
        : String(SITE_CONFIG_DEFAULTS[f.key] || '');
      return [f.label, value];
    });
    sheet.getRange(2, 1, seedRows.length, 2).setValues(seedRows);
    sheet.getRange(2, 2, seedRows.length, 1).setNumberFormat('@STRING@');
    sheet.autoResizeColumns(1, 1);
    sheet.setColumnWidth(2, 420);
  }
  return sheet;
}

function readSiteConfig_() {
  const config = Object.assign({}, SITE_CONFIG_DEFAULTS);
  try {
    const sheet = siteConfigSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const rows = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
      rows.forEach(function(row) {
        const key = siteConfigKeyFromCell_(row[0]);
        const rawValue = String(row[1] || '').trim();
        if (!key || !rawValue) return;
        config[key] = key === 'sheetId' ? (extractSheetId_(rawValue) || config.sheetId) : rawValue;
      });
    }
  } catch (error) {
    // 시트를 못 읽는 경우(권한 문제 등)에도 기본값으로 계속 동작합니다.
  }
  return config;
}

function writeSiteConfigToSheet_(config) {
  const sheet = siteConfigSheet_();
  const lastRow = sheet.getLastRow();
  const existing = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
  const rowByKey = {};
  existing.forEach(function(row, i) {
    const key = siteConfigKeyFromCell_(row[0]);
    if (key) rowByKey[key] = i + 2;
  });
  SITE_CONFIG_FIELDS.forEach(function(field) {
    const key = field.key;
    const value = key === 'sheetId'
      ? ('https://docs.google.com/spreadsheets/d/' + String(config[key] || '') + '/edit')
      : String(config[key] == null ? '' : config[key]);
    const rowNumber = rowByKey[key] || (sheet.getLastRow() + 1);
    sheet.getRange(rowNumber, 1).setValue(field.label); // 예전 영문 키였다면 한글 라벨로 갱신
    sheet.getRange(rowNumber, 2).setNumberFormat('@STRING@').setValue(value);
  });
}

function cleanSiteUrl_(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';
  if (!/^https?:\/\//i.test(text)) throw new Error('주소는 http:// 또는 https://로 시작해야 합니다.');
  return text.replace(/\/$/, '');
}

function siteConfigGet_() { return json_({ success: true, config: readSiteConfig_() }); }

function siteConfigUpdate_(request) {
  const account = accountWithPermissions_(request.loginId, request.password);
  if (!account.isMaster) throw new Error('사이트 설정은 마스터 계정만 변경할 수 있습니다.');
  const input = request.config || {};
  const config = readSiteConfig_();
  if (input.sheetId != null) {
    const id = extractSheetId_(input.sheetId);
    if (!id) throw new Error('시트 주소(링크) 또는 ID가 올바르지 않습니다.');
    config.sheetId = id;
  }
  ['writeApiUrl', 'timetableOfficialUrl', 'timetableServerUrl', 'windowsInstallerUrl'].forEach(function(key) {
    if (input[key] != null) config[key] = cleanSiteUrl_(input[key]);
  });
  if (input.schoolCode != null) config.schoolCode = String(input.schoolCode).trim();
  writeSiteConfigToSheet_(config);
  PropertiesService.getScriptProperties().setProperty(SITE_CONFIG_PROPERTY, JSON.stringify(config)); // 백업용으로 계속 같이 저장
  return json_({ success: true, config: config, message: '사이트 설정이 저장되었습니다.' });
}

/* ---------------- 시트 읽기·로그인을 서버가 대신 처리 (스프레드시트를 비공개로 돌려도 동작) ---------------- */
// 이 목록의 시트는 로그인한 계정만 읽을 수 있습니다(학생 개인정보 보호).
const SENSITIVE_READ_SHEETS = ['학생 활동 기록', '수업 진도'];

function readSheetRowsRaw_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error("'" + name + "' 시트를 찾지 못했습니다.");
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];
  const rows = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  if (name === ROSTER_SHEET_NAME && rows.length) {
    // '교사 아이디 비번' 시트는 비밀번호 칸을 항상 비워서 돌려줍니다. 브라우저는 절대 실제 비밀번호를 받지 않습니다.
    const header = rows[0].map(function(v) { return String(v || '').replace(/\s+/g, '').trim(); });
    const pwIndex = header.findIndex(function(h) { return ['비밀번호', '비번', '패스워드'].indexOf(h) >= 0; });
    if (pwIndex >= 0) {
      for (var i = 1; i < rows.length; i++) rows[i][pwIndex] = '';
    }
  }
  return rows;
}

function sheetRead_(request) {
  const name = String(request.sheetName || '').trim();
  if (!name) throw new Error('시트 이름이 필요합니다.');
  if (SENSITIVE_READ_SHEETS.indexOf(name) >= 0) {
    // 로그인 정보가 유효하지 않으면 accountWithPermissions_ 내부에서 에러를 던집니다.
    accountWithPermissions_(request.loginId, request.password);
  }
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  return json_({ success: true, sheetName: name, rows: readSheetRowsRaw_(spreadsheet, name) });
}

// 여러 시트를 한 번의 요청으로 모아서 읽습니다. 시트마다 따로 서버를 호출하면 매번
// 스프레드시트를 여는 왕복 지연이 쌓여서(특히 로그인 직후 화면 전체를 채울 때) 느려지므로,
// 로딩 속도를 위해 한 번의 실행에서 스프레드시트를 한 번만 열고 전부 읽어서 돌려줍니다.
function sheetReadBatch_(request) {
  const names = Array.isArray(request.sheetNames) ? request.sheetNames.map(function(n) { return String(n || '').trim(); }).filter(Boolean) : [];
  if (!names.length) throw new Error('시트 이름 목록이 필요합니다.');
  const needsAuth = names.some(function(n) { return SENSITIVE_READ_SHEETS.indexOf(n) >= 0; });
  if (needsAuth) accountWithPermissions_(request.loginId, request.password);
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  const sheets = {};
  const errors = {};
  names.forEach(function(name) {
    try { sheets[name] = readSheetRowsRaw_(spreadsheet, name); }
    catch (error) { errors[name] = errorMessage_(error); }
  });
  return json_({ success: true, sheets: sheets, errors: errors });
}

function loginCheck_(request) {
  const account = accountWithPermissions_(request.loginId, request.password);
  return json_({ success: true, account: { id: account.loginId, name: account.realName, role: account.isMaster ? 'admin' : 'teacher' } });
}

function jsonp_(data, callback) {
  const safeCallback = String(callback || '').match(/^[A-Za-z_$][0-9A-Za-z_$\.]*$/) ? String(callback) : '';
  if (!safeCallback) return json_(data);
  return ContentService.createTextOutput(safeCallback + '(' + JSON.stringify(data) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || '').trim();
  const callback = String(e && e.parameter && e.parameter.callback || '').trim();
  if (action === 'siteConfigGet') {
    const data = { success: true, config: readSiteConfig_() };
    return jsonp_(data, callback);
  }
  return jsonp_({ success: true, service: '기장중학교 교무 도우미', endpoint: 'doPost', permissionSheet: TEACHER_PERMISSION_SHEET_NAME, codeVersion: CODE_VERSION, features: ['sheetRead', 'sheetReadBatch', 'login', 'siteConfigSheet'] }, callback);
}

function doPost(e) {
   try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(request.action || '');
    if (action === 'activityAppend') return appendActivity_(request);
    if (action === 'progressAppend') return appendProgress_(request);
    if (action === 'personalRecords') return personalRecords_(request);
    if (action === 'personalRecordDelete') return personalRecordDelete_(request);
    if (action === 'dashboardWrite') return dashboardWrite_(request);
    if (action === 'dutyRotationSave') return saveDutyRotation_(request);
    if (action === 'permissionUpdate') return updateTeacherPermissions_(request);
    if (action === 'passwordChange') return changeTeacherPassword_(request);
    if (action === 'syncTimetableCache') return syncTimetableCacheAsAdmin_(request);
    if (action === 'siteConfigGet') return siteConfigGet_();
    if (action === 'siteConfigUpdate') return siteConfigUpdate_(request);
    if (action === 'sheetRead') return sheetRead_(request);
    if (action === 'sheetReadBatch') return sheetReadBatch_(request);
    if (action === 'login') return loginCheck_(request);
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

/** 비밀번호 셀은 항상 '일반 텍스트' 서식으로 고정한 뒤 문자열 그대로 저장합니다.
 * 서식을 고정하지 않으면 순수 숫자거나 날짜처럼 보이는 비밀번호(예: 0417, 3/4)를
 * 구글 시트가 자동으로 숫자·날짜로 변환해 버려서, 저장한 그대로 로그인할 수 없게 됩니다. */
function setPasswordCell_(range, password) {
  range.setNumberFormat('@STRING@').setValue(String(password == null ? '' : password));
}

function rosterSheet_() {
  const sheet = SpreadsheetApp.openById(configuredSpreadsheetId_()).getSheetByName(ROSTER_SHEET_NAME);
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
  row[columns.realName] = realName;
  sheet.appendRow(row);
  setPasswordCell_(sheet.getRange(sheet.getLastRow(), columns.password + 1), password);
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
  if (password) setPasswordCell_(sheet.getRange(existing.rowNumber, columns.password + 1), password);
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
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
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
  const syncedAt = new Date();
  const syncedAtText = Utilities.formatDate(syncedAt, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  // 데이터 표의 열은 건드리지 않고, 오른쪽 K1:L1에 시트 전체 갱신 시각을 한 번만 표시합니다.
  sheet.getRange('K1:L1').setValues([['시간표 캐시 전체 업데이트 시각', syncedAtText]]);
  sheet.getRange('K1').setFontWeight('bold').setBackground('#e6efe7');
  sheet.getRange('L1').setNumberFormat('@');
  PropertiesService.getScriptProperties().setProperty('TIMETABLE_LAST_SYNC', syncedAt.toISOString());
  return { success: true, periods: Object.keys(seenPeriods).length, rows: rows.length - 1, syncedAt: syncedAt.toISOString(), syncedAtText: syncedAtText };
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


/* ---------------- 수업 진도 구글 시트 동기화 ---------------- */
const PROGRESS_SPREADSHEET_ID = ROSTER_SPREADSHEET_ID;
const PROGRESS_SHEET_NAME = '수업 진도';

function appendProgress_(request) {
  const loginId = String(request.loginId || '').trim();
  const password = String(request.password || '');
  const record = request.record || {};
  if (!loginId || !password) throw new Error('교사 로그인 확인 정보가 없습니다.');

  const spreadsheet = SpreadsheetApp.openById(PROGRESS_SPREADSHEET_ID);
  const roster = spreadsheet.getSheetByName(ROSTER_SHEET_NAME);
  if (!roster) throw new Error('교사 아이디 비번 시트를 찾지 못했습니다.');
  const columns = columns_(roster);
  const account = accounts_(roster, columns).find(function(item) {
    return item.loginId === loginId && item.password === password;
  });
  if (!account) throw new Error('교사 로그인 확인에 실패했습니다.');

  let sheet = spreadsheet.getSheetByName(PROGRESS_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PROGRESS_SHEET_NAME);
    sheet.appendRow(['기록일', '교사아이디', '교사실명', '학년', '반', '교과', '진도내용', '비고', '기록ID']);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() < 1) {
    sheet.appendRow(['기록일', '교사아이디', '교사실명', '학년', '반', '교과', '진도내용', '비고', '기록ID']);
    sheet.setFrozenRows(1);
  }

  const recordId = String(record.recordId || (new Date().getTime() + '-' + Math.random()));
  const existingIds = sheet.getLastRow() > 1
    ? sheet.getRange(2, 9, sheet.getLastRow() - 1, 1).getDisplayValues().flat()
    : [];
  if (existingIds.indexOf(recordId) >= 0) {
    return json_({ success: true, duplicate: true, recordId: recordId });
  }

  sheet.appendRow([
    String(record.date || ''),
    account.loginId,
    account.realName,
    String(record.grade || ''),
    String(record.cls || ''),
    String(record.subject || ''),
    String(record.content || ''),
    String(record.memo || ''),
    recordId
  ]);
  return json_({ success: true, recordId: recordId, teacherName: account.realName });
}

function createProgressSheet_() {
  const spreadsheet = SpreadsheetApp.openById(PROGRESS_SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(PROGRESS_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PROGRESS_SHEET_NAME);
    sheet.appendRow(['기록일', '교사아이디', '교사실명', '학년', '반', '교과', '진도내용', '비고', '기록ID']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Apps Script에서 직접 실행하면 수업 진도 시트만 미리 생성합니다. */
function createProgressSheet() {
  const sheet = createProgressSheet_();
  SpreadsheetApp.getActiveSpreadsheet().toast('수업 진도 시트를 준비했습니다: ' + sheet.getName(), '수업 진도', 5);
}

/** Apps Script에서 직접 실행하면 수업 진도 시트의 현재 상태를 로그로 확인합니다. */
function checkProgressSheet() {
  const sheet = createProgressSheet_();
  const result = { sheet: sheet.getName(), rows: Math.max(0, sheet.getLastRow() - 1) };
  Logger.log(JSON.stringify(result));
  return result;
}

/* ---------------- 수업 진도 구글 시트 동기화 끝 ---------------- */


/* ---------------- 조별 반복 주간 당번표 ---------------- */
const WEEKLY_DUTY_ROTATION_SHEET_NAME = '조별 반복 당번표';
const WEEKLY_DUTY_ROTATION_ROWS = [
  ['1학년', '정미영', '박수진', '최미자', '이혜원', '이경현'],
  ['2학년', '김준우', '이하나', '오수부', '손선미', '허은심'],
  ['3학년', '강인혜', '한천우', '유영미', '김예빈', '이미지'],
  ['방송통제', '오수부', '오수부', '김효진', '최우영', '최우영'],
  ['줄서기 지도', '최우영', '최우영', '최우영', '오수부', '오수부'],
  ['1학년', '이윤서', '손영탁', '채봉선', '하인목', '이남희'],
  ['2학년', '임세니', '김효진', '정선윤', '박현아', '김미정'],
  ['3학년', '이아영', '엄동현', '오수부', '남미선', '채시은'],
  ['방송통제', '오수부', '오수부', '김효진', '최우영', '최우영'],
  ['줄서기 지도', '최우영', '최우영', '최우영', '오수부', '오수부']
];

function mondayOf_(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDateKo_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function getWeeklyDutyRotation_(sheet) {
  const base = sheet.getRange('B2').getValue();
  const baseMonday = base instanceof Date ? mondayOf_(base) : mondayOf_(new Date());
  const currentMonday = mondayOf_(new Date());
  const weekDiff = Math.floor((currentMonday.getTime() - baseMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.abs(weekDiff) % 2 === 0 ? 1 : 2;
}

function createWeeklyDutyRotationSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(WEEKLY_DUTY_ROTATION_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(WEEKLY_DUTY_ROTATION_SHEET_NAME);
  if (sheet.getLastRow() > 0) {
    updateWeeklyDutyRotationStatus();
    spreadsheet.toast('기존 조별 반복 당번표를 열었습니다. 담당자 이름과 반복 체크는 시트에서 바로 수정할 수 있습니다.', '조별 당번표 관리', 8);
    spreadsheet.setActiveSheet(sheet);
    return sheet;
  }

  const todayMonday = mondayOf_(new Date());
  sheet.getRange('A1:G1').merge();
  sheet.getRange('A1').setValue('조별 반복 주간 당번표');
  sheet.getRange('A2').setValue('기준 월요일');
  sheet.getRange('B2').setValue(todayMonday).setNumberFormat('yyyy-mm-dd');
  sheet.getRange('D2').setValue('반복 주기');
  sheet.getRange('E2').setValue('2주');
  sheet.getRange('F2').setValue('이번 주 담당 조');
  sheet.getRange('G2').setFormula('=IF(MOD(INT((TODAY()-B2)/7),2)=0,"1조","2조")');

  writeDutyGroup_(sheet, 4, '1조', WEEKLY_DUTY_ROTATION_ROWS.slice(0, 5));
  writeDutyGroup_(sheet, 12, '2조', WEEKLY_DUTY_ROTATION_ROWS.slice(5, 10));

  sheet.getRange('A1:G1').setFontWeight('bold').setFontSize(15).setBackground('#1F4D3A').setFontColor('#FFFFFF').setHorizontalAlignment('center');
  sheet.getRange('A2:G2').setBackground('#F5E8D0').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setColumnWidths(1, 1, 130);
  sheet.setColumnWidths(2, 5, 125);
  sheet.setColumnWidth(7, 95);
  sheet.setFrozenRows(2);
  sheet.getRange('A1:G18').setVerticalAlignment('middle');
  sheet.getRange('A1:G18').setHorizontalAlignment('center');
  updateWeeklyDutyRotationStatus();
  spreadsheet.setActiveSheet(sheet);
  spreadsheet.toast('1조·2조 반복 당번표를 만들었습니다. ‘반복 확인’ 체크를 이용해 이번 주 담당을 관리하세요.', '조별 당번표 관리', 10);
  return sheet;
}

function writeDutyGroup_(sheet, startRow, groupName, rows) {
  sheet.getRange(startRow, 1, 1, 7).merge();
  sheet.getRange(startRow, 1).setValue('[' + groupName + ']');
  sheet.getRange(startRow + 1, 1, 1, 7).setValues([['업무', '월', '화', '수', '목', '금', '반복 확인']]);
  const values = rows.map(function(row) { return row.concat([false]); });
  sheet.getRange(startRow + 2, 1, values.length, 7).setValues(values);
  sheet.getRange(startRow, 1, 1, 7).setBackground(groupName === '1조' ? '#E6F0E9' : '#FDE8DC').setFontWeight('bold').setHorizontalAlignment('left');
  sheet.getRange(startRow + 1, 1, 1, 7).setBackground('#FFF8EB').setFontWeight('bold');
  sheet.getRange(startRow + 2, 7, values.length, 1).insertCheckboxes();
  sheet.getRange(startRow + 1, 1, values.length + 1, 7).setBorder(true, true, true, true, true, true);
}

function updateWeeklyDutyRotationStatus() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(WEEKLY_DUTY_ROTATION_SHEET_NAME) || createWeeklyDutyRotationSheet();
  const group = getWeeklyDutyRotation_(sheet);
  const activeGroupRow = group === 1 ? 4 : 12;
  const inactiveGroupRow = group === 1 ? 12 : 4;
  sheet.getRange('G2').setValue(group + '조');
  sheet.getRange(activeGroupRow, 1, 1, 7).setBackground('#C9E66D');
  sheet.getRange(inactiveGroupRow, 1, 1, 7).setBackground(group === 1 ? '#FDE8DC' : '#E6F0E9');
  spreadsheet.toast('이번 주는 ' + group + '조 담당입니다. 해당 조의 ‘반복 확인’ 체크를 관리하세요.', '조별 당번표 관리', 8);
  return { group: group, monday: formatDateKo_(mondayOf_(new Date())) };
}

function showWeeklyDutyRotationStatus() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(WEEKLY_DUTY_ROTATION_SHEET_NAME) || createWeeklyDutyRotationSheet();
  const result = updateWeeklyDutyRotationStatus();
  SpreadsheetApp.getUi().alert('이번 주 조별 당번', result.monday + ' 주간은 ' + result.group + '조 담당입니다.\n\n당번표 시트에서 담당 교사 이름을 수정하고, 확인한 업무는 마지막 열의 체크박스를 선택하세요.', SpreadsheetApp.getUi().ButtonSet.OK);
  spreadsheet.setActiveSheet(sheet);
}

/* ---------------- 조별 반복 주간 당번표 끝 ---------------- */


/* ---------------- 교사별 웹 수정 권한·개인 설정 ---------------- */
const PERMISSION_HEADERS = {
  calendar: '학사일정수정',
  notice: '전달사항수정',
  duty: '급식당번수정'
};

function setupTeacherPermissionColumns() {
  const sheet = rosterSheet_();
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getDisplayValues()[0].map(String);
  const permissionSheet = ensureTeacherPermissionSheet_(sheet);
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  spreadsheet.toast('교사 권한 관리 시트를 만들고 계정을 동기화했습니다: ' + permissionSheet.getName(), '교사 권한 관리', 8);
  spreadsheet.setActiveSheet(permissionSheet);
  return { rosterHeaders: headers, permissionSheet: permissionSheet.getName(), spreadsheetId: configuredSpreadsheetId_() };
}

function ensureTeacherPermissionSheet_(rosterSheet) {
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  const wantedName = String(TEACHER_PERMISSION_SHEET_NAME).trim();
  let sheet = spreadsheet.getSheetByName(wantedName);
  if (!sheet) sheet = spreadsheet.getSheets().find(function(candidate) { return String(candidate.getName()).trim() === wantedName; });
  if (!sheet) sheet = spreadsheet.insertSheet(wantedName);
  const headers = ['아이디', '교사실명', '학사일정수정', '전달사항수정', '급식당번수정'];
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1F4D3A').setFontColor('#FFFFFF');
  const rosterHeaders = rosterSheet.getRange(1, 1, 1, Math.max(1, rosterSheet.getLastColumn())).getDisplayValues()[0].map(String);
  const normalized = rosterHeaders.map(normalizeHeader_);
  const idCol = normalized.findIndex(function(h) { return h === '아이디' || h === '교사아이디'; });
  const nameCol = normalized.findIndex(function(h) { return h === '교사실명' || h === '실명' || h === '성명' || h === '교사이름'; });
  if (idCol < 0) throw new Error('회원 명부에 아이디 열이 없습니다.');
  const rosterValues = rosterSheet.getDataRange().getDisplayValues();
  const existing = sheet.getLastRow() >= 2 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues() : [];
  const oldById = {};
  existing.forEach(function(row) { if (row[0]) oldById[String(row[0]).trim()] = row; });
  const output = rosterValues.slice(1).filter(function(row) { return String(row[idCol] || '').trim(); }).map(function(row) {
    const id = String(row[idCol] || '').trim();
    const old = oldById[id] || ['', '', '', '', ''];
    return [id, nameCol >= 0 ? String(row[nameCol] || '').trim() : id, old[2] || '', old[3] || '', old[4] || ''];
  });
  if (sheet.getMaxRows() < Math.max(2, output.length + 1)) sheet.insertRowsAfter(sheet.getMaxRows(), output.length + 1 - sheet.getMaxRows());
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  if (output.length) sheet.getRange(2, 1, output.length, headers.length).setValues(output);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function normalizePermission_(value) {
  return ['1', 'true', '허용', 'yes', 'y', 'on'].indexOf(String(value || '').trim().toLowerCase()) >= 0;
}

function ensurePermissionColumns_(sheet) {
  if (!sheet) throw new Error('회원 명부 시트를 찾지 못했습니다.');
  if (sheet.getLastRow() < 1) sheet.getRange(1, 1).setValue('연번');
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) { return String(value || '').trim(); });
  const additions = Object.keys(PERMISSION_HEADERS).map(function(key) { return PERMISSION_HEADERS[key]; }).filter(function(label) {
    return headers.map(normalizeHeader_).indexOf(normalizeHeader_(label)) < 0;
  });
  if (additions.length) {
    const startColumn = Math.max(1, sheet.getLastColumn()) + 1;
    sheet.getRange(1, startColumn, 1, additions.length).setValues([additions]);
    sheet.getRange(1, startColumn, 1, additions.length).setFontWeight('bold').setBackground('#E6F0E9');
    sheet.autoResizeColumns(startColumn, additions.length);
  }
  return sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getDisplayValues()[0].map(String);
}

function accountWithPermissions_(loginId, password) {
  const sheet = rosterSheet_();
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getDisplayValues()[0].map(String);
  const permissionSheet = ensureTeacherPermissionSheet_(sheet);
  const normalized = headers.map(normalizeHeader_);
  const idIndex = normalized.findIndex(function(header) { return ['아이디','교사아이디'].indexOf(header) >= 0; });
  const passwordIndex = normalized.findIndex(function(header) { return ['비밀번호','비번','패스워드'].indexOf(header) >= 0; });
  const nameIndex = normalized.findIndex(function(header) { return ['교사실명','실명','성명','교사이름'].indexOf(header) >= 0; });
  const roleIndex = normalized.findIndex(function(header) { return ['권한','역할','role'].indexOf(header) >= 0; });
  const values = sheet.getDataRange().getDisplayValues();
  const rowIndex = values.slice(1).findIndex(function(row) {
    return String(row[idIndex] == null ? '' : row[idIndex]).trim() === String(loginId == null ? '' : loginId).trim() && String(row[passwordIndex] == null ? '' : row[passwordIndex]).trim() === String(password == null ? '' : password).trim();
  });
  if (rowIndex < 0) throw new Error('교사 로그인 확인에 실패했습니다.');
  const row = values[rowIndex + 1];
  const role = roleIndex >= 0 ? String(row[roleIndex] || '').trim().toLowerCase() : '';
  const loginName = String(row[idIndex] || '').trim();
  const realName = nameIndex >= 0 ? String(row[nameIndex] || '').trim() : loginName;
  const isMaster = /^(마스터|master|admin|관리자)$/i.test(loginName) || /^(마스터|master|admin|관리자)$/i.test(realName) || ['admin','master','관리자','마스터'].indexOf(role) >= 0;
  const permissions = {};
  const permissionValues = permissionSheet.getDataRange().getDisplayValues();
  const permissionRow = permissionValues.slice(1).find(function(permissionRowData) { return String(permissionRowData[0] || '').trim() === loginName; });
  Object.keys(PERMISSION_HEADERS).forEach(function(key) {
    const col = ['학사일정수정', '전달사항수정', '급식당번수정'].indexOf(PERMISSION_HEADERS[key]) + 2;
    permissions[key] = isMaster || !!(permissionRow && normalizePermission_(permissionRow[col]));
  });
  return { sheet: sheet, headers: headers, rowNumber: rowIndex + 2, loginId: loginName, realName: realName, isMaster: isMaster, permissions: permissions, passwordIndex: passwordIndex };
}

function requirePermission_(request, permission) {
  const account = accountWithPermissions_(request.loginId, request.password);
  if (!account.permissions[permission]) throw new Error('이 기능의 수정 권한이 없습니다. 마스터 관리자에게 권한을 요청하세요.');
  return account;
}

function personalRecords_(request) {
  const account = accountWithPermissions_(request.loginId, request.password);
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  function rowsFor(name, teacherColumn) {
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 1) return [];
    const values = sheet.getDataRange().getDisplayValues();
    if (!values.length) return [];
    return [values[0]].concat(values.slice(1).filter(function(row) { return String(row[teacherColumn] || '').trim() === account.loginId; }));
  }
  return json_({success:true, progress:rowsFor(PROGRESS_SHEET_NAME,1), activity:rowsFor(ACTIVITY_SHEET_NAME,1), teacherId:account.loginId});
}

function personalRecordDelete_(request) {
  const account = accountWithPermissions_(request.loginId, request.password);
  const kind = String(request.kind || '');
  const sheetName = kind === 'progress' ? PROGRESS_SHEET_NAME : kind === 'activity' ? ACTIVITY_SHEET_NAME : '';
  if (!sheetName) throw new Error('삭제할 개인 기록 종류가 올바르지 않습니다.');
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) throw new Error('삭제할 기록 시트를 찾지 못했습니다.');
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(function(value) { return normalizeHeader_(value); });
  const teacherCol = headers.indexOf('교사아이디');
  const recordCol = headers.indexOf('기록ID');
  if (teacherCol < 0 || recordCol < 0) throw new Error(sheetName + ' 시트의 교사아이디·기록ID 열을 찾지 못했습니다.');
  const recordId = String(request.recordId || '').trim();
  const targetIndex = values.slice(1).findIndex(function(row) { return String(row[teacherCol] || '').trim() === account.loginId && String(row[recordCol] || '').trim() === recordId; });
  if (targetIndex < 0) throw new Error('본인의 삭제할 기록을 찾지 못했습니다.');
  sheet.deleteRow(targetIndex + 2);
  return json_({success:true, kind:kind, recordId:recordId});
}

function dashboardSheet_(spreadsheet, resource) {
  const aliases = resource === 'notice' ? ['담임교사 전달사항', '담임교사 안내사항', '안내사항'] : ['학사일정'];
  const normalizedAliases = aliases.map(function(name) { return normalizeHeader_(name); });
  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (normalizedAliases.indexOf(normalizeHeader_(sheets[i].getName())) >= 0) return sheets[i];
  }
  const canonical = aliases[0];
  const sheet = spreadsheet.insertSheet(canonical);
  const headers = resource === 'notice' ? ['안내시작일', '안내종료일', '개시 학년', '안내사항'] : ['날짜', '제목', '내용'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  return sheet;
}

function dashboardWrite_(request) {
  const rawResource = String(request.resource || request.sheetName || '').trim().toLowerCase();
  const resource = ['notice', '담임교사 전달사항', '담임교사 안내사항', '안내사항'].indexOf(rawResource) >= 0 ? 'notice' : ['calendar', '학사일정'].indexOf(rawResource) >= 0 ? 'calendar' : rawResource;
  const config = { calendar: { permission: 'calendar' }, notice: { permission: 'notice' } }[resource];
  if (!config) throw new Error('지원하지 않는 수정 항목입니다.');
  requirePermission_(request, config.permission);
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  const sheet = dashboardSheet_(spreadsheet, resource);
  const mode = String(request.mode || 'append');
  const row = Array.isArray(request.row) ? request.row.map(function(value) { return String(value == null ? '' : value); }) : [];
  if (mode !== 'delete' && !row.length) throw new Error('저장할 내용이 없습니다.');
  if (mode === 'update') {
    const rowNumber = Number(request.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow()) throw new Error('수정할 기존 행을 찾지 못했습니다.');
    sheet.getRange(rowNumber, 1, 1, Math.max(sheet.getLastColumn(), row.length)).clearContent();
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else if (mode === 'delete') {
    const rowNumber = Number(request.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow()) throw new Error('삭제할 기존 행을 찾지 못했습니다.');
    sheet.deleteRow(rowNumber);
  } else {
    sheet.appendRow(row);
  }
  return json_({ success: true, resource: resource, mode: mode });
}

function saveDutyRotation_(request) {
  const account = requirePermission_(request, 'duty');
  const group = Number(request.group);
  const rows = Array.isArray(request.rows) ? request.rows : [];
  if ([1, 2].indexOf(group) < 0 || !rows.length) throw new Error('저장할 조별 당번표 내용이 없습니다.');
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  const sheet = spreadsheet.getSheetByName(WEEKLY_DUTY_ROTATION_SHEET_NAME);
  if (!sheet) throw new Error('조별 반복 당번표 시트를 먼저 만들어야 합니다. 시트 상단 ‘조별 당번표 관리’ 메뉴를 사용하세요.');
  const firstColumn = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 1).getDisplayValues().flat();
  const groupIndex = firstColumn.findIndex(function(value) { return String(value).replace(/[\[\]\s]/g, '') === String(group) + '조'; });
  if (groupIndex < 0) throw new Error(group + '조 표를 찾지 못했습니다.');
  const startRow = groupIndex + 3;
  const output = rows.slice(0, 5).map(function(row) {
    const task = String(row.task || '').trim();
    const days = Array.isArray(row.days) ? row.days.slice(0, 5).map(function(value) { return String(value || '').trim(); }) : [];
    if (!task) throw new Error('업무 이름을 입력하세요.');
    while (days.length < 5) days.push('');
    return [task].concat(days);
  });
  sheet.getRange(startRow, 1, output.length, 6).setValues(output);
  return json_({ success: true, group: group, editor: account.realName });
}

function updateTeacherPermissions_(request) {
  const master = accountWithPermissions_(request.loginId, request.password);
  if (!master.isMaster) throw new Error('마스터 관리자만 교사별 수정 권한을 설정할 수 있습니다.');
  const targetId = String(request.targetId || '').trim();
  if (!targetId) throw new Error('권한을 설정할 교사를 선택하세요.');
  const permissionSheet = ensureTeacherPermissionSheet_(rosterSheet_());
  let values = permissionSheet.getDataRange().getDisplayValues();
  let targetIndex = values.slice(1).findIndex(function(row) { return String(row[0] || '').trim() === targetId; });
  if (targetIndex < 0) {
    ensureTeacherPermissionSheet_(rosterSheet_());
    values = permissionSheet.getDataRange().getDisplayValues();
    targetIndex = values.slice(1).findIndex(function(row) { return String(row[0] || '').trim() === targetId; });
  }
  if (targetIndex < 0) throw new Error('선택한 교사 계정을 교사 권한 관리 시트에서 찾지 못했습니다.');
  const permissions = request.permissions || {};
  Object.keys(PERMISSION_HEADERS).forEach(function(key) {
    const permissionColumn = ['학사일정수정', '전달사항수정', '급식당번수정'].indexOf(PERMISSION_HEADERS[key]) + 3;
    permissionSheet.getRange(targetIndex + 2, permissionColumn).setValue(permissions[key] ? '허용' : '');
  });
  return json_({ success: true, targetId: targetId, sheet: TEACHER_PERMISSION_SHEET_NAME });
}

function changeTeacherPassword_(request) {
  const account = accountWithPermissions_(request.loginId, request.currentPassword);
  const nextPassword = String(request.newPassword || '');
  if (nextPassword.length < 4) throw new Error('새 비밀번호는 4자 이상으로 입력하세요.');
  setPasswordCell_(account.sheet.getRange(account.rowNumber, account.passwordIndex + 1), nextPassword);
  return json_({ success: true });
}

/* ---------------- 교사별 웹 수정 권한·개인 설정 끝 ---------------- */


/* ---------------- 엑셀 명렬표 업로드·학년별/전체 명렬표 갱신 ---------------- */
const ROSTER_GRADE_SHEET_PREFIX = '학년 명렬표';
const ROSTER_ALL_SHEET_NAME = '전체 명렬표';

function normalizeRosterText_(value) {
  return String(value == null ? '' : value).replace(/\u00a0/g, ' ').trim();
}

function rosterGradeSheetName_(grade) {
  return String(grade) + '학년 명렬표';
}

function menuUploadRosterExcel_() {
  const html = HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="UTF-8"><style>' +
    'body{font-family:Arial,sans-serif;padding:18px;color:#26352d}h3{margin:0 0 10px}p{font-size:13px;line-height:1.5}.row{margin:14px 0}.drop-zone{border:2px dashed #6d9b7d;border-radius:10px;background:#f3f8f1;padding:24px 12px;text-align:center;color:#386047;cursor:pointer}.drop-zone.over{background:#e1f1e1;border-color:#285b43}.drop-zone input{display:block;margin:12px auto 0}button{background:#285b43;color:#fff;border:0;border-radius:6px;padding:9px 14px;cursor:pointer}button:disabled{opacity:.55;cursor:wait}#status{margin-top:12px;font-size:13px;white-space:pre-wrap}' +
    '</style></head><body><h3>📋 학년별 명렬표 엑셀 업로드</h3>' +
    '<p>파일명에 <b>1학년</b>, <b>2학년</b>, <b>3학년</b> 중 하나가 포함되어야 합니다.<br>예: 1학년명렬.xlsx</p>' +
    '<div class="row"><div id="dropZone" class="drop-zone">엑셀 파일을 여기에 끌어다 놓거나<br><input id="file" type="file" accept=".xlsx" /></div></div>' +
    '<button id="btn" onclick="upload()">업로드하고 명렬표 갱신</button><div id="status"></div>' +
    '<script>var selectedFile=null;function showFile(f){if(!f)return;selectedFile=f;document.getElementById("dropZone").firstChild.textContent="선택됨: "+f.name;document.getElementById("status").textContent="업로드할 파일이 선택되었습니다.";}function upload(){var f=selectedFile||document.getElementById("file").files[0],b=document.getElementById("btn"),s=document.getElementById("status");if(!f){s.textContent="엑셀 파일을 선택하거나 끌어다 놓으세요.";return;}b.disabled=true;s.textContent="업로드·변환 중입니다...";var r=new FileReader();r.onload=function(){var base64=String(r.result).split(",")[1]||"";google.script.run.withSuccessHandler(function(x){s.textContent=(x&&x.message)||"완료되었습니다.";b.disabled=false;selectedFile=null;document.getElementById("file").value="";document.getElementById("dropZone").firstChild.textContent="엑셀 파일을 여기에 끌어다 놓거나";alert("업로드 완료되었습니다.\\n\\n"+((x&&x.message)||"명렬표와 전체 명렬표가 갱신되었습니다.")+"\\n\\n다른 파일을 선택해 계속 업로드할 수 있습니다.");}).withFailureHandler(function(e){s.textContent="실패: "+(e&&e.message||e);b.disabled=false;}).uploadRosterExcelBase64(f.name,base64);};r.onerror=function(){s.textContent="파일을 읽지 못했습니다.";b.disabled=false;};r.readAsDataURL(f);}var dz=document.getElementById("dropZone"),fi=document.getElementById("file");fi.addEventListener("change",function(){showFile(this.files[0]);});["dragenter","dragover"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add("over");});});["dragleave","drop"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove("over");});});dz.addEventListener("drop",function(e){showFile(e.dataTransfer.files[0]);});</script></body></html>'
  ).setWidth(430).setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, '📋 명렬표 엑셀 업로드');
}

function uploadRosterExcelBase64(fileName, base64) {
  const name = normalizeRosterText_(fileName);
  const match = name.match(/([123])\s*학년/);
  if (!match) throw new Error('파일 이름에 1학년·2학년·3학년 중 하나가 포함되어야 합니다.');
  if (!base64) throw new Error('엑셀 파일 데이터가 비어 있습니다.');
  const bytes = Utilities.base64Decode(base64);
  const rows = parseRosterXlsxRows_(bytes);
  if (!rows.length || rows.every(function(row) { return row.every(function(v) { return !normalizeRosterText_(v); }); })) {
    throw new Error('엑셀 파일에서 명렬표 내용을 찾지 못했습니다.');
  }
  const grade = Number(match[1]);
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  const gradeSheet = ensureRosterGradeSheet_(spreadsheet, grade);
  writeRosterRows_(gradeSheet, rows, grade);
  const allResult = rebuildAllRosterSheet_();
  return { success: true, grade: grade, sheet: gradeSheet.getName(), rows: Math.max(0, rows.length - 1), totalRows: allResult.rows, message: grade + '학년 명렬표를 업데이트했고 전체 명렬표까지 갱신했습니다. (' + Math.max(0, rows.length - 1) + '명)' };
}

function ensureRosterGradeSheet_(spreadsheet, grade) {
  const name = rosterGradeSheetName_(grade);
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  return sheet;
}

function writeRosterRows_(sheet, rawRows, grade) {
  const rows = rawRows.map(function(row, rowIndex) {
    const values = row.slice(0, 5).map(normalizeRosterText_);
    if (rowIndex === 0) {
      const headerText = values.join('|');
      if (!/학년/.test(headerText)) values = ['학년', '반', '번호', '성명', '비고'];
      return values;
    }
    while (values.length < 5) values.push('');
    if (!values[0]) values[0] = String(grade);
    return values;
  });
  if (!rows.length || !/학년/.test(rows[0].join('|'))) rows.unshift(['학년', '반', '번호', '성명', '비고']);
  const width = Math.max(5, rows.reduce(function(max, row) { return Math.max(max, row.length); }, 0));
  const normalized = rows.map(function(row) { const copy = row.slice(); while (copy.length < width) copy.push(''); return copy; });
  sheet.clearContents();
  sheet.getRange(1, 1, normalized.length, width).setValues(normalized);
  sheet.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#e6efe7');
  sheet.autoResizeColumns(1, width);
}

function rebuildAllRosterSheet_() {
  const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId_());
  let allSheet = spreadsheet.getSheetByName(ROSTER_ALL_SHEET_NAME);
  if (!allSheet) allSheet = spreadsheet.insertSheet(ROSTER_ALL_SHEET_NAME);
  const output = [['학년', '반', '번호', '성명', '비고']];
  [1, 2, 3].forEach(function(grade) {
    const sheet = spreadsheet.getSheetByName(rosterGradeSheetName_(grade));
    if (!sheet || sheet.getLastRow() < 2) return;
    const values = sheet.getRange(1, 1, sheet.getLastRow(), Math.max(5, sheet.getLastColumn())).getDisplayValues();
    values.slice(1).forEach(function(row) {
      const item = row.slice(0, 5);
      while (item.length < 5) item.push('');
      if (!item.some(function(v) { return normalizeRosterText_(v); })) return;
      item[0] = normalizeRosterText_(item[0]) || String(grade);
      output.push(item);
    });
  });
  allSheet.clearContents();
  allSheet.getRange(1, 1, output.length, 5).setValues(output);
  allSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#e6efe7');
  allSheet.autoResizeColumns(1, 5);
  return { rows: Math.max(0, output.length - 1), sheet: ROSTER_ALL_SHEET_NAME };
}

function parseRosterXlsxRows_(bytes) {
  const blobs = Utilities.unzip(Utilities.newBlob(bytes, 'application/zip', 'roster.xlsx'));
  const files = {};
  blobs.forEach(function(blob) { files[blob.getName()] = blob; });
  const sheetName = Object.keys(files).find(function(name) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(name); });
  if (!sheetName) throw new Error('엑셀 첫 번째 시트를 찾지 못했습니다. .xlsx 파일인지 확인하세요.');
  const shared = files['xl/sharedStrings.xml'] ? parseSharedStrings_(files['xl/sharedStrings.xml'].getDataAsString()) : [];
  const document = XmlService.parse(files[sheetName].getDataAsString());
  const root = document.getRootElement();
  const ns = root.getNamespace();
  const sheetData = root.getChild('sheetData', ns);
  if (!sheetData) return [];
  const output = [];
  sheetData.getChildren('row', ns).forEach(function(rowElement) {
    const row = [];
    rowElement.getChildren('c', ns).forEach(function(cell) {
      const ref = cell.getAttribute('r');
      const col = ref ? excelColumnIndex_(ref.getValue()) : row.length;
      let value = '';
      const type = cell.getAttribute('t');
      if (type && type.getValue() === 'inlineStr') {
        const is = cell.getChild('is', ns);
        value = is ? inlineStringValue_(is, ns) : '';
      } else {
        const v = cell.getChild('v', ns);
        value = v ? v.getText() : '';
        if (type && type.getValue() === 's' && value !== '') value = shared[Number(value)] || '';
      }
      row[col] = value;
    });
    while (row.length && row[row.length - 1] == null) row.pop();
    output.push(row.map(function(v) { return v == null ? '' : v; }));
  });
  return output;
}

function parseSharedStrings_(xmlText) {
  const document = XmlService.parse(xmlText);
  const root = document.getRootElement();
  const ns = root.getNamespace();
  return root.getChildren('si', ns).map(function(si) { return inlineStringValue_(si, ns); });
}

function inlineStringValue_(element, ns) {
  return element.getDescendants().filter(function(node) { return node.getType && node.getType() === XmlService.ContentTypes.ELEMENT && node.asElement().getName() === 't'; }).map(function(node) { return node.asElement().getText(); }).join('');
}

function excelColumnIndex_(cellRef) {
  const letters = String(cellRef).match(/^[A-Z]+/i);
  if (!letters) return 0;
  return letters[0].toUpperCase().split('').reduce(function(total, ch) { return total * 26 + ch.charCodeAt(0) - 64; }, 0) - 1;
}

/* ---------------- 명렬표 메뉴 아이콘 ---------------- */
(function addRosterMenuToOnOpenSource_() {})();
