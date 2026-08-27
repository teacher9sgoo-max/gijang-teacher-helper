/* 학생 활동 기록 시트 저장 패치
 * 기존 Apps Script의 doPost(e)에서 requireSecret_(request)보다 먼저
 * 아래 분기를 한 줄 추가하세요.
 *
 * if (action === 'activityAppend') return appendActivity_(request);
 */

const ACTIVITY_SPREADSHEET_ID = '1_qIRbv44zWd9yv4yNzTQ0frXTvILl2-iejzPqhF8i2w';
const ACTIVITY_SHEET_NAME = '학생 활동 기록';

function appendActivity_(request) {
  const loginId = String(request.loginId || '').trim();
  const password = String(request.password || '');
  const record = request.record || {};
  if (!loginId || !password) throw new Error('교사 로그인 확인 정보가 없습니다.');

  const roster = SpreadsheetApp.openById(ACTIVITY_SPREADSHEET_ID).getSheetByName('교사 아이디 비번');
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

  let sheet = SpreadsheetApp.openById(ACTIVITY_SPREADSHEET_ID).getSheetByName(ACTIVITY_SHEET_NAME);
  if (!sheet) {
    sheet = SpreadsheetApp.openById(ACTIVITY_SPREADSHEET_ID).insertSheet(ACTIVITY_SHEET_NAME);
    sheet.appendRow(['기록일','교사아이디','교사실명','학년','반','번호','활동내용','비고','기록ID']);
  } else if (sheet.getLastRow() < 1) {
    sheet.appendRow(['기록일','교사아이디','교사실명','학년','반','번호','활동내용','비고','기록ID']);
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
