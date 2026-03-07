/* ===========================================
   문서율 시간표 - script.js
   LocalStorage 기반 시간표 관리 앱
   =========================================== */


/* ─── 상수 ─── */

const DAYS = ['월', '화', '수', '목', '금'];

const DEFAULT_PERIODS = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시'];

const PASTEL_COLORS = [
  { hex: '#FFB3BA', name: '연분홍' },
  { hex: '#FFCBA4', name: '연살구' },
  { hex: '#FFF0BA', name: '연크림' },
  { hex: '#BAFFC9', name: '연민트' },
  { hex: '#BAE1FF', name: '연하늘' },
  { hex: '#E8BAFF', name: '연보라' },
  { hex: '#FFB3E6', name: '연핑크' },
  { hex: '#B3FFE8', name: '연청록' },
  { hex: '#D9FFB3', name: '연연두' },
  { hex: '#B3D9FF', name: '연파랑' },
  { hex: '#FFB3D9', name: '연장미' },
  { hex: '#D9B3FF', name: '연라벤더' },
  { hex: '#FFDFBA', name: '연복숭아' },
  { hex: '#B3FFD9', name: '연에메랄드' },
  { hex: '#FFE4E1', name: '연로즈' },
];

// 기본 과목 11개 → 색상 인덱스 매핑
const DEFAULT_SUBJECTS_DATA = [
  { name: '생태와 환경', colorIdx: 0  },
  { name: '대수',        colorIdx: 4  },
  { name: '창체',        colorIdx: 3  },
  { name: '중국어',      colorIdx: 2  },
  { name: '스생',        colorIdx: 6  },
  { name: '생명',        colorIdx: 8  },
  { name: '세계시민',    colorIdx: 5  },
  { name: '영어',        colorIdx: 1  },
  { name: '문학',        colorIdx: 10 },
  { name: '화학',        colorIdx: 7  },
  { name: '음창',        colorIdx: 14 },
];


/* ─── 전역 상태 ─── */

let subjects       = [];   // [{id, name, color, visible}]
let timetableItems = [];   // [{id, day, period, subjectName, classroom, color}]
let snapshots      = [];   // [{id, name, savedAt, items, subjects}]
let lastSnapshotId = null;

// 모달 상태
// 'add'       : 특정 셀의 + 버튼으로 열림 (day/period 고정)
// 'add-full'  : 다른 교시에 추가 버튼으로 열림 (day/period 선택 가능)
// 'edit'      : 수업 클릭으로 열림 (모든 필드 수정 가능)
let modalMode       = 'add';
let modalFixedDay   = '';
let modalFixedPeriod = '';
let modalEditItemId = null;

// 모바일 탭에서 현재 선택된 요일
let activeDayTab = '월';

// 모바일 뷰 모드: 'full' (전체 표) | 'day' (요일별)
let activeViewMode = 'full';

const FIREBASE_URL = 'https://highschoolschedule-917dd-default-rtdb.asia-southeast1.firebasedatabase.app';


/* ─── 초기화 ─── */

function init() {
  loadFromLocalStorage();

  if (subjects.length === 0) {
    initDefaultSubjects();
  }

  renderTimetable();
  renderSubjectList();

  // Firebase에서 자동 동기화 (비동기)
  syncFromFirebase();
}

function initDefaultSubjects() {
  DEFAULT_SUBJECTS_DATA.forEach(data => {
    subjects.push({
      id:      generateId(),
      name:    data.name,
      color:   PASTEL_COLORS[data.colorIdx].hex,
      visible: true,
    });
  });
  saveToLocalStorage();
}


/* ─── Firebase 동기화 ─── */

/** Firebase에서 최신 데이터 가져오기 (페이지 로드 시 자동 호출) */
async function syncFromFirebase() {
  try {
    const res = await fetch(`${FIREBASE_URL}/timetable.json`);

    if (!res.ok) {
      showToast(`Firebase 동기화 실패 (${res.status}) 😢`, 'error');
      return;
    }

    const data = await res.json();
    if (!data) return; // 아직 저장된 데이터 없음

    if (data._app !== '문서율 시간표') {
      showToast('Firebase의 데이터 형식이 올바르지 않아요 😢', 'error');
      return;
    }

    subjects       = data.subjects       || [];
    timetableItems = data.timetableItems || [];
    saveToLocalStorage();
    renderTimetable();
    renderSubjectList();
    showToast('🔄 Firebase에서 최신 시간표를 불러왔어요!', 'success');

  } catch (e) {
    console.error('[문서율] Firebase 동기화 오류:', e);
    showToast('Firebase 동기화 중 오류가 발생했어요 😢', 'error');
  }
}

/** Firebase에 현재 데이터 저장 */
async function pushToFirebase() {
  const payload = {
    _version: 1,
    _app: '문서율 시간표',
    updatedAt: new Date().toISOString(),
    subjects,
    timetableItems,
  };

  const res = await fetch(`${FIREBASE_URL}/timetable.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return res.ok;
}

/** 저장하기 버튼 핸들러 */
async function onSaveButtonClick() {
  const btn       = document.getElementById('saveBtn');
  const btnMobile = document.getElementById('saveBtnMobile');
  if (btn)       { btn.disabled = true; btn.textContent = '⏳ 저장 중...'; }
  if (btnMobile) { btnMobile.disabled = true; }

  try {
    const ok = await pushToFirebase();
    if (ok) {
      showToast('✅ Firebase에 저장했어요! 다른 기기에서 새로고침하면 반영돼요 🎉', 'success');
    } else {
      showToast('❌ Firebase 저장 실패. 잠시 후 다시 시도해주세요', 'error');
    }
  } finally {
    if (btn)       { btn.disabled = false; btn.textContent = '💾 저장하기'; }
    if (btnMobile) { btnMobile.disabled = false; }
  }
}


/* ─── LocalStorage ─── */

function loadFromLocalStorage() {
  try {
    const rawSubjects  = localStorage.getItem('subjects');
    const rawItems     = localStorage.getItem('timetableItems');
    const rawSnapshots = localStorage.getItem('timetableSnapshots');
    const rawLastId    = localStorage.getItem('lastOpenedSnapshotId');

    if (rawSubjects)  subjects       = JSON.parse(rawSubjects);
    if (rawItems)     timetableItems = JSON.parse(rawItems);
    if (rawSnapshots) snapshots      = JSON.parse(rawSnapshots);
    if (rawLastId)    lastSnapshotId = rawLastId;
  } catch (e) {
    console.error('[문서율] LocalStorage 불러오기 오류:', e);
    subjects = []; timetableItems = []; snapshots = []; lastSnapshotId = null;
  }
}

function saveToLocalStorage() {
  try {
    localStorage.setItem('subjects',           JSON.stringify(subjects));
    localStorage.setItem('timetableItems',     JSON.stringify(timetableItems));
    localStorage.setItem('timetableSnapshots', JSON.stringify(snapshots));
    if (lastSnapshotId) localStorage.setItem('lastOpenedSnapshotId', lastSnapshotId);
  } catch (e) {
    console.error('[문서율] LocalStorage 저장 오류:', e);
    showToast('저장 중 오류가 발생했어요 😢', 'error');
  }
}


/* ─── 시간표 렌더링 (데스크탑 + 모바일 동시) ─── */

/**
 * 모든 뷰를 새로 그립니다.
 * 수업 데이터가 바뀔 때마다 호출하세요.
 */
function renderTimetable() {
  updateEmptyHint();
  renderDesktopTable();
  renderMobileDayView();
  if (activeViewMode === 'full') renderMobileFullView();
}

/** 빈 시간표 안내 문구 업데이트 */
function updateEmptyHint() {
  const hint = document.getElementById('emptyHint');
  hint.style.display = timetableItems.length === 0 ? 'inline' : 'none';
}

/**
 * 데스크탑 테이블 tbody를 렌더링합니다.
 * 빈 셀에는 + 버튼을, 수업 있는 셀에는 색상 카드를 표시합니다.
 */
function renderDesktopTable() {
  const tbody = document.getElementById('timetableBody');
  tbody.innerHTML = '';

  getAllPeriods().forEach(period => {
    const tr = document.createElement('tr');

    // 교시 셀
    const periodTd = document.createElement('td');
    periodTd.className = 'period-cell';
    periodTd.textContent = period;
    tr.appendChild(periodTd);

    // 요일별 셀
    DAYS.forEach(day => {
      const td = document.createElement('td');
      td.className = 'timetable-cell';

      const item = timetableItems.find(i => i.day === day && i.period === period);

      if (item) {
        // 수업 있음: 색상 카드 (클릭 시 수정 모달)
        const card = document.createElement('div');
        card.className = 'cell-content';
        card.style.backgroundColor = item.color;
        card.title = `${item.subjectName}${item.classroom ? ' · ' + item.classroom : ''} — 클릭하여 수정`;
        card.innerHTML = `
          <span class="cell-subject">${escapeHtml(item.subjectName)}</span>
          ${item.classroom ? `<span class="cell-classroom">${escapeHtml(item.classroom)}</span>` : ''}
        `;
        card.addEventListener('click', () => openEditModal(item.id));
        td.appendChild(card);
      } else {
        // 빈 셀: + 버튼 (클릭 시 추가 모달)
        const btn = document.createElement('button');
        btn.className = 'cell-add-btn';
        btn.textContent = '+';
        btn.title = `${day}요일 ${period} 수업 추가`;
        btn.addEventListener('click', () => openAddModal(day, period));
        td.appendChild(btn);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

/**
 * 모바일 탭 뷰: activeDayTab 요일의 교시 목록을 렌더링합니다.
 */
function renderMobileDayView() {
  const content = document.getElementById('mobileDayContent');
  content.innerHTML = '';

  const day = activeDayTab;

  getAllPeriods().forEach(period => {
    const item = timetableItems.find(i => i.day === day && i.period === period);

    const row = document.createElement('div');
    row.className = 'mobile-period-row';

    // 교시 라벨
    const label = document.createElement('span');
    label.className = 'mobile-period-label';
    // "1교시" → "1" 짧게 표시
    label.textContent = period.replace('교시', '') + '교시';
    row.appendChild(label);

    if (item) {
      // 수업 있는 행: 색상 카드
      const card = document.createElement('div');
      card.className = 'mobile-subject-card';
      card.style.backgroundColor = item.color;
      card.innerHTML = `
        <div class="mobile-subject-info">
          <span class="mobile-subject-name">${escapeHtml(item.subjectName)}</span>
          ${item.classroom ? `<span class="mobile-classroom">${escapeHtml(item.classroom)}</span>` : ''}
          ${item.memo ? `<span class="mobile-memo">${escapeHtml(item.memo)}</span>` : ''}
        </div>
        <span class="mobile-edit-icon">✏️</span>
      `;
      card.addEventListener('click', () => openEditModal(item.id));
      row.appendChild(card);
    } else {
      // 빈 행: + 추가 버튼
      const btn = document.createElement('button');
      btn.className = 'mobile-add-btn';
      btn.textContent = '+ 추가';
      btn.addEventListener('click', () => openAddModal(day, period));
      row.appendChild(btn);
    }

    content.appendChild(row);
  });
}

/**
 * 현재 데이터에 있는 모든 교시(기본 + 커스텀)를 반환합니다.
 */
function getAllPeriods() {
  const customPeriods = timetableItems
    .map(i => i.period)
    .filter(p => !DEFAULT_PERIODS.includes(p));
  const uniqueCustom = [...new Set(customPeriods)].sort((a, b) => a.localeCompare(b, 'ko'));
  return [...DEFAULT_PERIODS, ...uniqueCustom];
}

/**
 * 모바일 전체 표 뷰: 5일 × N교시 compact 표를 렌더링합니다.
 */
function renderMobileFullView() {
  const wrap = document.getElementById('mobileFullTableWrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  const periods = getAllPeriods();

  const table = document.createElement('table');
  table.className = 'mobile-full-table';

  // thead
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const thPeriod = document.createElement('th');
  thPeriod.className = 'mft-period-header';
  headerRow.appendChild(thPeriod);
  DAYS.forEach(day => {
    const th = document.createElement('th');
    th.className = 'mft-day-header';
    th.textContent = day;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // tbody
  const tbody = document.createElement('tbody');
  periods.forEach(period => {
    const tr = document.createElement('tr');

    // 교시 셀
    const periodTd = document.createElement('td');
    periodTd.className = 'mft-period-cell';
    if (period.endsWith('교시')) {
      const num = document.createTextNode(period.replace('교시', ''));
      const br = document.createElement('br');
      const small = document.createElement('small');
      small.textContent = '교시';
      periodTd.appendChild(num);
      periodTd.appendChild(br);
      periodTd.appendChild(small);
    } else {
      periodTd.textContent = period;
    }
    tr.appendChild(periodTd);

    // 요일별 셀
    DAYS.forEach(day => {
      const td = document.createElement('td');
      td.className = 'mft-cell';

      const item = timetableItems.find(i => i.day === day && i.period === period);
      if (item) {
        td.style.backgroundColor = item.color;
        td.title = `${item.subjectName}${item.classroom ? ' · ' + item.classroom : ''} — 클릭하여 수정`;

        const subjectSpan = document.createElement('span');
        subjectSpan.className = 'mft-subject';
        subjectSpan.textContent = item.subjectName;
        td.appendChild(subjectSpan);

        if (item.classroom) {
          const classroomSpan = document.createElement('span');
          classroomSpan.className = 'mft-classroom';
          classroomSpan.textContent = item.classroom;
          td.appendChild(classroomSpan);
        }

        td.addEventListener('click', () => openMemoPopup(item.id));
      } else {
        td.classList.add('mft-empty');
        td.textContent = '+';
        td.title = `${day}요일 ${period} 수업 추가`;
        td.addEventListener('click', () => openAddModal(day, period));
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
}

/**
 * 전체 표에서 수업 셀 터치 시 메모 팝업 표시
 */
function openMemoPopup(id) {
  const item = timetableItems.find(i => i.id === id);
  if (!item) return;

  const header = document.getElementById('memoPopupHeader');
  header.style.backgroundColor = item.color;

  document.getElementById('memoPopupSubject').textContent = item.subjectName;
  document.getElementById('memoPopupClassroom').textContent = item.classroom || '';

  const memoText = document.getElementById('memoPopupText');
  if (item.memo) {
    memoText.textContent = item.memo;
    memoText.style.color = '';
  } else {
    memoText.textContent = '메모가 없어요';
    memoText.style.color = 'var(--text-muted)';
  }

  document.getElementById('memoPopupEditBtn').onclick = () => {
    closeMemoPopup();
    openEditModal(id);
  };

  document.getElementById('memoPopup').style.display = 'flex';
}

function closeMemoPopup() {
  document.getElementById('memoPopup').style.display = 'none';
}

/**
 * 모바일 뷰 모드 전환 ('full' | 'day')
 */
function selectViewMode(mode) {
  activeViewMode = mode;

  document.querySelectorAll('.view-mode-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const fullView = document.getElementById('mobileFullView');
  const dayView  = document.getElementById('mobileDayView');
  if (fullView) fullView.style.display = mode === 'full' ? 'block' : 'none';
  if (dayView)  dayView.style.display  = mode === 'day'  ? 'block' : 'none';

  if (mode === 'full') renderMobileFullView();
}

/**
 * 모바일 탭 선택
 */
function selectDayTab(day) {
  activeDayTab = day;

  // 탭 버튼 active 클래스 업데이트
  document.querySelectorAll('.day-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.day === day);
  });

  renderMobileDayView();
}


/* ─── 수업 추가/수정 모달 ─── */

/**
 * 특정 셀의 + 버튼에서 호출 (day/period 고정).
 * 요일·교시 선택 필드를 숨기고 컨텍스트 텍스트만 표시합니다.
 */
function openAddModal(day, period) {
  modalMode        = 'add';
  modalFixedDay    = day;
  modalFixedPeriod = period;
  modalEditItemId  = null;

  // 제목 및 컨텍스트
  document.getElementById('addEditModalTitle').textContent = '수업 추가하기';
  const dayLabel = { 월:'월요일', 화:'화요일', 수:'수요일', 목:'목요일', 금:'금요일' };
  document.getElementById('addEditContext').textContent = `${dayLabel[day]} · ${period}`;

  // 요일·교시 선택 필드 숨김
  document.getElementById('modalDayPeriodFields').style.display = 'none';

  // 삭제 버튼 숨김
  document.getElementById('modalDeleteBtn').style.display = 'none';
  document.getElementById('modalSubmitBtn').textContent = '추가하기';

  // 폼 초기화
  document.getElementById('modalClassroom').value = '';
  document.getElementById('modalMemo').value = '';
  populateModalSubjectDropdown();
  renderModalColorPicker();

  // 과목 색상 자동 선택
  handleModalSubjectChange();

  document.getElementById('addEditModal').style.display = 'flex';
}

/**
 * "다른 교시에 추가하기" 버튼에서 호출.
 * 요일·교시 선택 필드를 표시합니다.
 */
function openAddModalFull() {
  modalMode       = 'add-full';
  modalEditItemId = null;

  document.getElementById('addEditModalTitle').textContent = '수업 추가하기';
  document.getElementById('addEditContext').textContent    = '요일과 교시를 직접 선택해주세요';

  // 요일·교시 선택 필드 표시
  document.getElementById('modalDayPeriodFields').style.display = 'block';
  document.getElementById('modalCustomPeriodGroup').style.display = 'none';
  document.getElementById('modalPeriod').value = '1교시';
  // 모바일이면 현재 탭 요일을, 아니면 월요일 기본값
  document.getElementById('modalDay').value = activeDayTab || '월';

  document.getElementById('modalDeleteBtn').style.display = 'none';
  document.getElementById('modalSubmitBtn').textContent = '추가하기';

  document.getElementById('modalClassroom').value = '';
  document.getElementById('modalMemo').value = '';
  populateModalSubjectDropdown();
  renderModalColorPicker();
  handleModalSubjectChange();

  document.getElementById('addEditModal').style.display = 'flex';
}

/**
 * 수업 카드 클릭 시 호출 (수정 모드).
 * 기존 데이터를 폼에 채우고 요일·교시 선택 필드를 표시합니다.
 */
function openEditModal(id) {
  const item = timetableItems.find(i => i.id === id);
  if (!item) return;

  modalMode       = 'edit';
  modalEditItemId = id;

  document.getElementById('addEditModalTitle').textContent = '수업 수정하기';
  const dayLabel = { 월:'월요일', 화:'화요일', 수:'수요일', 목:'목요일', 금:'금요일' };
  document.getElementById('addEditContext').textContent =
    `${dayLabel[item.day]} · ${item.period}`;

  // 요일·교시 선택 필드 표시 (수정 가능)
  document.getElementById('modalDayPeriodFields').style.display = 'block';
  document.getElementById('modalDay').value = item.day;

  const periodSelect = document.getElementById('modalPeriod');
  const customGroup  = document.getElementById('modalCustomPeriodGroup');
  if (DEFAULT_PERIODS.includes(item.period)) {
    periodSelect.value = item.period;
    customGroup.style.display = 'none';
  } else {
    periodSelect.value = 'custom';
    customGroup.style.display = 'block';
    document.getElementById('modalCustomPeriod').value = item.period;
  }

  // 과목, 교실, 메모 세팅
  populateModalSubjectDropdown(item.subjectName);
  document.getElementById('modalClassroom').value = item.classroom || '';
  document.getElementById('modalMemo').value = item.memo || '';

  // 색상 선택
  renderModalColorPicker();
  selectModalColor(item.color);

  // 삭제 버튼 표시
  document.getElementById('modalDeleteBtn').style.display = 'inline-flex';
  document.getElementById('modalSubmitBtn').textContent = '수정하기';

  document.getElementById('addEditModal').style.display = 'flex';
}

/** 모달 닫기 */
function closeAddEditModal() {
  document.getElementById('addEditModal').style.display = 'none';
}

/** 오버레이 클릭 시 닫기 */
function closeAddEditModalOutside(e) {
  if (e.target === document.getElementById('addEditModal')) closeAddEditModal();
}

/** 교시 select 변경 시 직접입력 필드 표시/숨김 */
function handleModalPeriodChange() {
  const val = document.getElementById('modalPeriod').value;
  const group = document.getElementById('modalCustomPeriodGroup');
  if (val === 'custom') {
    group.style.display = 'block';
    document.getElementById('modalCustomPeriod').focus();
  } else {
    group.style.display = 'none';
  }
}

/**
 * 과목 드롭다운 변경 시 해당 과목의 저장된 색상을 자동 선택합니다.
 * - 이미 시간표에 등록된 적 있으면 그 색상 사용 (가장 최근 것)
 * - 없으면 subjects 목록의 기본 색상 사용
 */
function handleModalSubjectChange() {
  const name = document.getElementById('modalSubject').value;
  if (!name) return;

  // 1순위: 시간표에서 마지막으로 사용한 색상
  const usedItems = timetableItems.filter(i => i.subjectName === name);
  if (usedItems.length > 0) {
    selectModalColor(usedItems[usedItems.length - 1].color);
    return;
  }

  // 2순위: subjects 목록의 기본 색상
  const subject = subjects.find(s => s.name === name);
  if (subject) {
    selectModalColor(subject.color);
  }
}

/**
 * 모달 폼 제출 (추가 또는 수정).
 */
function submitAddEditModal() {
  // day, period 결정
  let day, period;

  if (modalMode === 'add') {
    day    = modalFixedDay;
    period = modalFixedPeriod;
  } else {
    day = document.getElementById('modalDay').value;
    const ps = document.getElementById('modalPeriod').value;
    const cp = document.getElementById('modalCustomPeriod').value.trim();
    period = ps === 'custom' ? cp : ps;
  }

  const subjectName = document.getElementById('modalSubject').value;
  const classroom   = document.getElementById('modalClassroom').value.trim();
  const memo        = document.getElementById('modalMemo').value.trim();
  const color       = document.getElementById('modalColor').value;

  // 유효성 검사
  if (!period) {
    showToast('교시 또는 시간을 입력해주세요! 📝', 'error');
    document.getElementById('modalCustomPeriod').focus();
    return;
  }
  if (!subjectName) {
    showToast('과목을 선택해주세요! 📚', 'error');
    return;
  }
  if (!color) {
    showToast('색상을 선택해주세요! 🎨', 'error');
    return;
  }

  if (modalMode === 'edit') {
    // ── 수정 ──
    const conflict = timetableItems.find(
      i => i.day === day && i.period === period && i.id !== modalEditItemId
    );
    if (conflict) {
      if (!confirm(`${day}요일 ${period}에 이미 '${conflict.subjectName}' 수업이 있어요.\n덮어쓸까요?`)) return;
      timetableItems = timetableItems.filter(i => i.id !== conflict.id);
    }
    const idx = timetableItems.findIndex(i => i.id === modalEditItemId);
    if (idx !== -1) {
      timetableItems[idx] = { ...timetableItems[idx], day, period, subjectName, classroom, memo, color };
    }
    showToast('수업이 수정되었어요! ✏️', 'success');

  } else {
    // ── 추가 ──
    const conflict = timetableItems.find(i => i.day === day && i.period === period);
    if (conflict) {
      if (!confirm(`${day}요일 ${period}에 이미 '${conflict.subjectName}' 수업이 있어요.\n덮어쓸까요?`)) return;
      timetableItems = timetableItems.filter(i => i.id !== conflict.id);
    }
    timetableItems.push({ id: generateId(), day, period, subjectName, classroom, memo, color });
    showToast('수업이 추가되었어요! 🎉', 'success');
  }

  // 과목의 기본 색상을 마지막 사용 색상으로 업데이트 (다음 선택 시 자동 반영)
  updateSubjectColor(subjectName, color);

  saveToLocalStorage();
  renderTimetable();
  closeAddEditModal();
}

/** 수정 모달에서 삭제 버튼 */
function deleteFromModal() {
  const item = timetableItems.find(i => i.id === modalEditItemId);
  if (!item) return;

  if (confirm(`'${item.subjectName}' 수업을 삭제할까요?`)) {
    timetableItems = timetableItems.filter(i => i.id !== modalEditItemId);
    saveToLocalStorage();
    renderTimetable();
    closeAddEditModal();
    showToast('수업이 삭제되었어요 🗑️', 'success');
  }
}

/**
 * 과목의 저장 색상을 업데이트합니다.
 * 같은 과목을 다음에 선택할 때 이 색상이 자동으로 적용됩니다.
 */
function updateSubjectColor(subjectName, color) {
  const subject = subjects.find(s => s.name === subjectName);
  if (subject && subject.color !== color) {
    subject.color = color;
    saveToLocalStorage();
    renderSubjectList(); // 칩의 색상 점도 업데이트
  }
}


/* ─── 과목 드롭다운 (모달 내부) ─── */

/**
 * 모달의 과목 select를 채웁니다.
 * - visible=true 과목만, 가나다순 정렬
 * - preSelect: 이미 선택되어 있어야 할 과목명 (수정 모드용)
 */
function populateModalSubjectDropdown(preSelect) {
  const select = document.getElementById('modalSubject');

  const visibleSubjects = subjects
    .filter(s => s.visible)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  select.innerHTML = '';

  if (visibleSubjects.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '과목을 추가해주세요';
    select.appendChild(opt);
    return;
  }

  // 수정 모드인데 해당 과목이 숨겨져 있으면 임시로 추가
  if (preSelect && !visibleSubjects.some(s => s.name === preSelect)) {
    const tempOpt = document.createElement('option');
    tempOpt.value = preSelect;
    tempOpt.textContent = preSelect + ' (숨김)';
    select.appendChild(tempOpt);
  }

  visibleSubjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    select.appendChild(opt);
  });

  if (preSelect) {
    select.value = preSelect;
  }
}


/* ─── 색상 선택기 (모달 내부) ─── */

/** 모달의 색상 스와치를 렌더링합니다. */
function renderModalColorPicker() {
  const picker = document.getElementById('modalColorPicker');
  picker.innerHTML = PASTEL_COLORS.map(c => `
    <button type="button"
            class="color-swatch"
            style="background-color: ${c.hex};"
            title="${c.name}"
            data-color="${c.hex}"
            aria-label="${c.name} 선택">
    </button>
  `).join('');

  // 이벤트 위임으로 클릭 처리
  picker.addEventListener('click', e => {
    const swatch = e.target.closest('.color-swatch');
    if (swatch) selectModalColor(swatch.dataset.color);
  });
}

/**
 * 모달 색상 선택.
 * 선택된 스와치에 .selected 클래스를 부여하고 hidden input에 저장합니다.
 */
function selectModalColor(hex) {
  document.getElementById('modalColor').value = hex;
  document.querySelectorAll('#modalColorPicker .color-swatch').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === hex);
  });
}


/* ─── 과목 관리 ─── */

/**
 * 과목 목록 칩을 렌더링합니다.
 * - 가나다순 정렬
 * - 숨김 과목은 취소선 + 연하게
 */
function renderSubjectList() {
  const listEl = document.getElementById('subjectList');
  const sorted = [...subjects].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  if (sorted.length === 0) {
    listEl.innerHTML = '<p class="empty-subjects">과목이 없어요. 아래에서 추가해주세요!</p>';
    return;
  }

  listEl.innerHTML = sorted.map(s => `
    <div class="subject-chip ${s.visible ? '' : 'hidden-subject'}" data-id="${s.id}">
      <span class="subject-color-dot" style="background-color: ${s.color};"></span>
      <span class="subject-name">${escapeHtml(s.name)}</span>
      <button class="subject-toggle-btn"
              onclick="toggleSubjectVisibility('${s.id}')"
              title="${s.visible ? '드롭다운에서 숨기기' : '다시 표시'}"
              aria-label="${s.visible ? '숨기기' : '다시 표시'}">
        ${s.visible ? '✕' : '↩'}
      </button>
    </div>
  `).join('');
}

/** 새 과목 추가 */
function addSubject() {
  const input = document.getElementById('newSubjectInput');
  const name  = input.value.trim();

  if (!name) { showToast('과목명을 입력해주세요 📝', 'error'); input.focus(); return; }
  if (subjects.some(s => s.name === name)) {
    showToast('이미 등록된 과목이에요! 😅', 'error'); input.select(); return;
  }

  const usedColors    = new Set(subjects.map(s => s.color));
  const available     = PASTEL_COLORS.find(c => !usedColors.has(c.hex));
  const assignedColor = available
    ? available.hex
    : PASTEL_COLORS[subjects.length % PASTEL_COLORS.length].hex;

  subjects.push({ id: generateId(), name, color: assignedColor, visible: true });
  input.value = '';
  saveToLocalStorage();
  renderSubjectList();
  showToast(`'${name}' 과목이 추가되었어요! 📚`, 'success');
}

/** 과목 표시/숨김 토글 */
function toggleSubjectVisibility(id) {
  const subject = subjects.find(s => s.id === id);
  if (!subject) return;
  subject.visible = !subject.visible;
  saveToLocalStorage();
  renderSubjectList();
  const action = subject.visible ? '다시 표시했어요 👀' : '목록에서 숨겼어요 🙈';
  showToast(`'${subject.name}'을(를) ${action}`, 'success');
}


/* ─── 저장 / 불러오기 (스냅샷) ─── */

/** 현재 시간표를 타임스탬프 이름으로 저장 */
function saveSnapshot() {
  const now  = new Date();
  const name = `${formatDate(now)} 저장본`;
  const id   = generateId();

  snapshots.push({
    id,
    name,
    savedAt:  now.toISOString(),
    items:    JSON.parse(JSON.stringify(timetableItems)),
    subjects: JSON.parse(JSON.stringify(subjects)),
  });
  lastSnapshotId = id;
  saveToLocalStorage();
  showToast(`✨ '${name}'으로 저장되었어요!`, 'success');
}

function openLoadModal() {
  renderSnapshotList();
  document.getElementById('loadModal').style.display = 'flex';
}
function closeLoadModal() {
  document.getElementById('loadModal').style.display = 'none';
}
function closeLoadModalOutside(e) {
  if (e.target === document.getElementById('loadModal')) closeLoadModal();
}

function renderSnapshotList() {
  const listEl = document.getElementById('snapshotList');

  if (snapshots.length === 0) {
    listEl.innerHTML = `
      <p class="empty-snapshots">
        저장된 시간표가 없어요 😥<br />
        상단의 '저장하기' 버튼을 눌러 저장해보세요!
      </p>`;
    return;
  }

  const sorted = [...snapshots].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  listEl.innerHTML = sorted.map(snap => `
    <div class="snapshot-item ${snap.id === lastSnapshotId ? 'current' : ''}">
      <div class="snapshot-info">
        <span class="snapshot-name">${escapeHtml(snap.name)}</span>
        <span class="snapshot-count">${snap.items.length}개 수업</span>
        ${snap.id === lastSnapshotId ? '<span class="snapshot-badge">현재</span>' : ''}
      </div>
      <div class="snapshot-buttons">
        <button class="btn btn-small btn-primary"  onclick="loadSnapshot('${snap.id}')">불러오기</button>
        <button class="btn btn-small btn-danger"   onclick="deleteSnapshot('${snap.id}')">삭제</button>
      </div>
    </div>
  `).join('');
}

function loadSnapshot(id) {
  const snap = snapshots.find(s => s.id === id);
  if (!snap) return;

  timetableItems = JSON.parse(JSON.stringify(snap.items));
  subjects       = JSON.parse(JSON.stringify(snap.subjects));
  lastSnapshotId = id;

  saveToLocalStorage();
  renderTimetable();
  renderSubjectList();
  closeLoadModal();
  showToast(`📂 '${snap.name}'을(를) 불러왔어요!`, 'success');
}

function deleteSnapshot(id) {
  const snap = snapshots.find(s => s.id === id);
  if (!snap) return;
  if (!confirm(`'${snap.name}'을(를) 삭제할까요?`)) return;

  snapshots = snapshots.filter(s => s.id !== id);
  if (lastSnapshotId === id) lastSnapshotId = null;
  saveToLocalStorage();
  renderSnapshotList();
  showToast('저장본이 삭제되었어요 🗑️', 'success');
}


/* ─── 출력 ─── */
function printTimetable() { window.print(); }


/* ─── 내보내기 / 가져오기 ─── */

/**
 * 현재 시간표 데이터를 JSON 파일로 다운로드합니다.
 * 다른 기기에서 '가져오기'로 불러올 수 있습니다.
 */
function exportTimetable() {
  const data = {
    _version:   1,
    _app:       '문서율 시간표',
    exportedAt: new Date().toISOString(),
    subjects:       subjects,
    timetableItems: timetableItems,
    snapshots:      snapshots,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href     = url;
  a.download = `문서율시간표_${formatDate(new Date()).replace(/[: ]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('📤 시간표 파일이 다운로드됐어요! 카카오톡 등으로 공유해봐요', 'success');
}

/**
 * 파일 선택 다이얼로그를 열어 JSON 파일을 불러옵니다.
 */
function importTimetable() {
  document.getElementById('importFileInput').click();
}

/**
 * 선택된 JSON 파일을 읽어 시간표 데이터를 가져옵니다.
 * @param {Event} event
 */
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 다음 번 선택을 위해 input 초기화
  event.target.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // 파일 유효성 검사
      if (!data._app || data._app !== '문서율 시간표') {
        showToast('문서율 시간표에서 내보낸 파일이 아니에요 😢', 'error');
        return;
      }
      if (!Array.isArray(data.subjects) || !Array.isArray(data.timetableItems)) {
        showToast('파일 형식이 올바르지 않아요 😢', 'error');
        return;
      }

      const itemCount = data.timetableItems.length;
      if (!confirm(`📥 가져오기를 하면 현재 시간표가 파일의 내용으로 교체돼요.\n(수업 ${itemCount}개)\n\n계속할까요?`)) return;

      // 데이터 교체
      subjects       = data.subjects;
      timetableItems = data.timetableItems;
      if (Array.isArray(data.snapshots)) snapshots = data.snapshots;

      saveToLocalStorage();
      renderTimetable();
      renderSubjectList();
      showToast(`📥 시간표를 성공적으로 가져왔어요! (수업 ${itemCount}개)`, 'success');

    } catch (err) {
      console.error('[문서율] 가져오기 오류:', err);
      showToast('파일을 읽는 중 오류가 발생했어요 😢', 'error');
    }
  };

  reader.readAsText(file, 'UTF-8');
}


/* ─── 유틸리티 ─── */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function formatDate(date) {
  const Y   = date.getFullYear();
  const M   = String(date.getMonth() + 1).padStart(2, '0');
  const D   = String(date.getDate()).padStart(2, '0');
  const h   = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${min}`;
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = `toast toast-${type} show`;
  if (showToast._timer) clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { toast.className = 'toast'; }, 3000);
}


/* ─── 이벤트 등록 ─── */

document.addEventListener('DOMContentLoaded', init);

// ESC 키로 열린 모달 닫기
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('memoPopup').style.display     === 'flex') closeMemoPopup();
  if (document.getElementById('addEditModal').style.display  === 'flex') closeAddEditModal();
  if (document.getElementById('loadModal').style.display     === 'flex') closeLoadModal();
});
