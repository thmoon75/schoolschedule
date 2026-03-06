/* ===========================================
   문서율 시간표 - script.js
   LocalStorage 기반 시간표 관리 앱
   =========================================== */


/* ─────────────────────────────────────────
   상수 정의
   ───────────────────────────────────────── */

/** 요일 목록 (순서 고정) */
const DAYS = ['월', '화', '수', '목', '금'];

/** 기본 교시 목록 (표의 기본 행) */
const DEFAULT_PERIODS = [
  '1교시', '2교시', '3교시', '4교시',
  '5교시', '6교시', '7교시', '8교시',
];

/**
 * 15개 파스텔 색상 팔레트
 * hex: 색상 코드, name: 한국어 이름
 */
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

/**
 * 기본 과목 11개와 각각의 고유 파스텔 색상 매핑
 * 인덱스는 PASTEL_COLORS 배열의 index에 대응
 */
const DEFAULT_SUBJECTS_DATA = [
  { name: '상태와 환경', colorIdx: 0  },  // 연분홍
  { name: '대수',        colorIdx: 4  },  // 연하늘
  { name: '창체',        colorIdx: 3  },  // 연민트
  { name: '중국어',      colorIdx: 2  },  // 연크림
  { name: '스생',        colorIdx: 6  },  // 연핑크
  { name: '생명',        colorIdx: 8  },  // 연연두
  { name: '세계시민',    colorIdx: 5  },  // 연보라
  { name: '영어',        colorIdx: 1  },  // 연살구
  { name: '문학',        colorIdx: 10 },  // 연장미
  { name: '화학',        colorIdx: 7  },  // 연청록
  { name: '음창',        colorIdx: 14 },  // 연로즈
];


/* ─────────────────────────────────────────
   전역 상태 변수
   ───────────────────────────────────────── */

/**
 * 과목 목록
 * @type {Array<{id: string, name: string, color: string, visible: boolean}>}
 */
let subjects = [];

/**
 * 현재 시간표 항목 목록
 * @type {Array<{id: string, day: string, period: string, subjectName: string, classroom: string, color: string}>}
 */
let timetableItems = [];

/**
 * 저장된 스냅샷(저장본) 목록
 * @type {Array<{id: string, name: string, savedAt: string, items: Array, subjects: Array}>}
 */
let snapshots = [];

/** 마지막으로 저장하거나 불러온 스냅샷 ID */
let lastSnapshotId = null;

/** 현재 수정 중인 시간표 항목 ID (null이면 추가 모드) */
let editingItemId = null;

/** 팝업에 표시 중인 시간표 항목 ID */
let currentPopupItemId = null;


/* ─────────────────────────────────────────
   초기화
   ───────────────────────────────────────── */

/**
 * 페이지 로드 시 실행되는 진입점
 * LocalStorage에서 데이터를 불러오고 UI를 초기화합니다.
 */
function init() {
  // 1. LocalStorage에서 데이터 불러오기
  loadFromLocalStorage();

  // 2. 처음 실행이면 기본 과목 추가
  if (subjects.length === 0) {
    initDefaultSubjects();
  }

  // 3. UI 구성 요소 렌더링
  renderColorPicker();       // 색상 선택기
  renderSubjectDropdown();   // 과목 드롭다운
  renderSubjectList();       // 과목 목록 칩
  renderTimetable();         // 시간표 테이블

  // 4. 초기 색상 선택 (과목 드롭다운의 첫 번째 항목 기준)
  handleSubjectChange();
}

/**
 * 기본 과목 11개를 초기 데이터로 추가합니다.
 */
function initDefaultSubjects() {
  DEFAULT_SUBJECTS_DATA.forEach(data => {
    subjects.push({
      id: generateId(),
      name: data.name,
      color: PASTEL_COLORS[data.colorIdx].hex,
      visible: true,
    });
  });
  saveToLocalStorage();
}


/* ─────────────────────────────────────────
   LocalStorage 입출력
   ───────────────────────────────────────── */

/**
 * LocalStorage에서 모든 데이터를 불러옵니다.
 * 파싱 오류 시 기본값으로 초기화합니다.
 */
function loadFromLocalStorage() {
  try {
    const rawSubjects   = localStorage.getItem('subjects');
    const rawItems      = localStorage.getItem('timetableItems');
    const rawSnapshots  = localStorage.getItem('timetableSnapshots');
    const rawLastId     = localStorage.getItem('lastOpenedSnapshotId');

    if (rawSubjects)  subjects       = JSON.parse(rawSubjects);
    if (rawItems)     timetableItems = JSON.parse(rawItems);
    if (rawSnapshots) snapshots      = JSON.parse(rawSnapshots);
    if (rawLastId)    lastSnapshotId = rawLastId;
  } catch (e) {
    console.error('[문서율 시간표] LocalStorage 불러오기 오류:', e);
    subjects       = [];
    timetableItems = [];
    snapshots      = [];
    lastSnapshotId = null;
  }
}

/**
 * 현재 상태를 모두 LocalStorage에 저장합니다.
 * 변경이 발생할 때마다 호출됩니다 (자동 저장 역할).
 */
function saveToLocalStorage() {
  try {
    localStorage.setItem('subjects',             JSON.stringify(subjects));
    localStorage.setItem('timetableItems',       JSON.stringify(timetableItems));
    localStorage.setItem('timetableSnapshots',   JSON.stringify(snapshots));
    if (lastSnapshotId) {
      localStorage.setItem('lastOpenedSnapshotId', lastSnapshotId);
    }
  } catch (e) {
    console.error('[문서율 시간표] LocalStorage 저장 오류:', e);
    showToast('저장 중 오류가 발생했어요 😢', 'error');
  }
}


/* ─────────────────────────────────────────
   시간표 렌더링
   ───────────────────────────────────────── */

/**
 * 시간표 테이블의 tbody를 전체 재렌더링합니다.
 * - 기본 1~8교시 + 커스텀 교시 행을 표시합니다.
 * - 각 셀에 수업 항목 또는 빈 셀을 표시합니다.
 */
function renderTimetable() {
  const tbody    = document.getElementById('timetableBody');
  const emptyHint = document.getElementById('emptyHint');

  // 사용 중인 커스텀 교시 수집 (DEFAULT_PERIODS에 없는 것들)
  const usedCustomPeriods = timetableItems
    .map(item => item.period)
    .filter(p => !DEFAULT_PERIODS.includes(p));

  // 중복 제거 후 기본 교시와 합치기
  const customPeriods = [...new Set(usedCustomPeriods)].sort((a, b) =>
    a.localeCompare(b, 'ko')
  );
  const allPeriods = [...DEFAULT_PERIODS, ...customPeriods];

  // 빈 시간표 안내 문구 표시 여부
  emptyHint.style.display = timetableItems.length === 0 ? 'inline' : 'none';

  // tbody 초기화 후 재생성
  tbody.innerHTML = '';

  allPeriods.forEach(period => {
    const tr = document.createElement('tr');

    // ── 교시 셀 ──
    const periodTd = document.createElement('td');
    periodTd.className = 'period-cell';
    periodTd.textContent = period;
    tr.appendChild(periodTd);

    // ── 요일별 셀 ──
    DAYS.forEach(day => {
      const td = document.createElement('td');
      td.className = 'timetable-cell';

      // 해당 요일 + 교시에 해당하는 수업 찾기
      const item = timetableItems.find(i => i.day === day && i.period === period);

      if (item) {
        // 수업이 있는 셀: 색상 배경 + 클릭 시 팝업
        td.innerHTML = `
          <div class="cell-content"
               style="background-color: ${escapeHtml(item.color)};"
               onclick="openItemPopup('${escapeHtml(item.id)}')"
               title="${escapeHtml(item.subjectName)}${item.classroom ? ' · ' + escapeHtml(item.classroom) : ''}">
            <span class="cell-subject">${escapeHtml(item.subjectName)}</span>
            ${item.classroom
              ? `<span class="cell-classroom">${escapeHtml(item.classroom)}</span>`
              : ''}
          </div>
        `;
      } else {
        // 빈 셀: 클릭 시 해당 요일·교시로 폼 자동 세팅
        td.innerHTML = `
          <div class="cell-empty"
               onclick="setFormToCell('${day}', '${escapeHtml(period)}')"
               title="${day}요일 ${period} 수업 추가하기">
          </div>
        `;
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

/**
 * 빈 셀 클릭 시 해당 요일·교시를 폼에 자동으로 세팅하고
 * 폼 영역으로 부드럽게 스크롤합니다.
 * @param {string} day    - 요일 (월/화/수/목/금)
 * @param {string} period - 교시 문자열
 */
function setFormToCell(day, period) {
  // 요일 선택
  document.getElementById('inputDay').value = day;

  // 교시 선택 (기본 교시면 select로, 아니면 직접 입력으로)
  const periodSelect   = document.getElementById('inputPeriod');
  const customGroup    = document.getElementById('customPeriodGroup');
  const customInput    = document.getElementById('inputCustomPeriod');

  if (DEFAULT_PERIODS.includes(period)) {
    periodSelect.value = period;
    customGroup.style.display = 'none';
  } else {
    periodSelect.value = 'custom';
    customGroup.style.display = 'block';
    customInput.value = period;
  }

  // 폼으로 스크롤
  document.getElementById('itemForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}


/* ─────────────────────────────────────────
   폼 처리 (수업 추가 / 수정)
   ───────────────────────────────────────── */

/**
 * 폼 제출 이벤트 핸들러
 * 추가 모드와 수정 모드를 모두 처리합니다.
 * @param {Event} event
 */
function handleFormSubmit(event) {
  event.preventDefault();

  // ── 폼 값 수집 ──
  const day          = document.getElementById('inputDay').value;
  const periodSelect = document.getElementById('inputPeriod').value;
  const customPeriod = document.getElementById('inputCustomPeriod').value.trim();
  const period       = periodSelect === 'custom' ? customPeriod : periodSelect;
  const subjectName  = document.getElementById('inputSubject').value;
  const classroom    = document.getElementById('inputClassroom').value.trim();
  const color        = document.getElementById('selectedColor').value || PASTEL_COLORS[0].hex;

  // ── 유효성 검사 ──
  if (!period) {
    showToast('교시 또는 시간을 입력해주세요! 📝', 'error');
    document.getElementById('inputCustomPeriod').focus();
    return;
  }
  if (!subjectName) {
    showToast('과목을 선택해주세요! 📚', 'error');
    return;
  }

  if (editingItemId) {
    // ── 수정 모드 ──
    const idx = timetableItems.findIndex(i => i.id === editingItemId);
    if (idx !== -1) {
      // 같은 위치에 다른 수업이 있는지 확인 (자기 자신은 제외)
      const conflict = timetableItems.find(
        i => i.day === day && i.period === period && i.id !== editingItemId
      );
      if (conflict) {
        const ok = confirm(
          `${day}요일 ${period}에 이미 '${conflict.subjectName}' 수업이 있어요.\n덮어쓸까요?`
        );
        if (!ok) return;
        timetableItems = timetableItems.filter(i => i.id !== conflict.id);
      }

      // 항목 업데이트
      timetableItems[timetableItems.findIndex(i => i.id === editingItemId)] = {
        ...timetableItems[timetableItems.findIndex(i => i.id === editingItemId)],
        day, period, subjectName, classroom, color,
      };
      showToast('수업이 수정되었어요! ✏️', 'success');
    }
    cancelEdit();

  } else {
    // ── 추가 모드 ──
    // 중복 확인
    const conflict = timetableItems.find(i => i.day === day && i.period === period);
    if (conflict) {
      const ok = confirm(
        `${day}요일 ${period}에 이미 '${conflict.subjectName}' 수업이 있어요.\n덮어쓸까요?`
      );
      if (!ok) return;
      timetableItems = timetableItems.filter(i => i.id !== conflict.id);
    }

    // 새 항목 추가
    timetableItems.push({
      id:          generateId(),
      day,
      period,
      subjectName,
      classroom,
      color,
    });
    showToast('수업이 추가되었어요! 🎉', 'success');
  }

  // 저장 및 시간표 재렌더링
  saveToLocalStorage();
  renderTimetable();

  // 교실 입력만 초기화 (요일·교시·과목은 유지해서 연속 입력 편의 제공)
  document.getElementById('inputClassroom').value = '';
}

/**
 * 교시 select가 변경될 때 직접 입력 필드를 표시/숨깁니다.
 */
function handlePeriodChange() {
  const val = document.getElementById('inputPeriod').value;
  const customGroup = document.getElementById('customPeriodGroup');
  if (val === 'custom') {
    customGroup.style.display = 'block';
    document.getElementById('inputCustomPeriod').focus();
  } else {
    customGroup.style.display = 'none';
  }
}

/**
 * 과목이 변경될 때 해당 과목의 기본 색상을 자동으로 선택합니다.
 */
function handleSubjectChange() {
  const subjectName = document.getElementById('inputSubject').value;
  const subject = subjects.find(s => s.name === subjectName && s.visible);
  if (subject) {
    selectColor(subject.color);
  }
}

/**
 * 수정 모드를 시작합니다.
 * 해당 항목의 데이터를 폼에 채우고 버튼 라벨을 바꿉니다.
 * @param {string} id - 수정할 항목의 ID
 */
function startEditItem(id) {
  const item = timetableItems.find(i => i.id === id);
  if (!item) return;

  editingItemId = id;

  // 폼에 기존 값 채우기
  document.getElementById('inputDay').value       = item.day;
  document.getElementById('inputClassroom').value = item.classroom || '';

  // 교시 세팅
  const periodSelect = document.getElementById('inputPeriod');
  const customGroup  = document.getElementById('customPeriodGroup');
  if (DEFAULT_PERIODS.includes(item.period)) {
    periodSelect.value = item.period;
    customGroup.style.display = 'none';
  } else {
    periodSelect.value = 'custom';
    customGroup.style.display = 'block';
    document.getElementById('inputCustomPeriod').value = item.period;
  }

  // 과목 세팅 (드롭다운에 없으면 임시로 옵션 추가)
  const subjectSelect = document.getElementById('inputSubject');
  const hasOption = Array.from(subjectSelect.options).some(o => o.value === item.subjectName);
  if (!hasOption) {
    const tempOpt = document.createElement('option');
    tempOpt.value = item.subjectName;
    tempOpt.textContent = item.subjectName;
    subjectSelect.appendChild(tempOpt);
  }
  subjectSelect.value = item.subjectName;

  // 색상 세팅
  selectColor(item.color);

  // 버튼 및 제목 변경
  document.getElementById('formTitle').textContent        = '✏️ 수업 수정하기';
  document.getElementById('submitBtn').textContent        = '수정하기';
  document.getElementById('cancelEditBtn').style.display = 'inline-flex';

  // 폼으로 스크롤
  document.getElementById('itemForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 수정 모드를 취소하고 폼을 초기 상태로 되돌립니다.
 */
function cancelEdit() {
  editingItemId = null;

  // 폼 초기화
  document.getElementById('inputClassroom').value         = '';
  document.getElementById('inputPeriod').value            = '1교시';
  document.getElementById('inputCustomPeriod').value      = '';
  document.getElementById('customPeriodGroup').style.display = 'none';

  // 버튼 및 제목 복원
  document.getElementById('formTitle').textContent        = '✏️ 수업 추가하기';
  document.getElementById('submitBtn').textContent        = '+ 추가하기';
  document.getElementById('cancelEditBtn').style.display = 'none';

  // 드롭다운 첫 번째 과목으로 초기화 + 색상 자동 설정
  renderSubjectDropdown();
}

/**
 * 수업을 삭제합니다.
 * @param {string} id - 삭제할 항목의 ID
 */
function deleteItem(id) {
  timetableItems = timetableItems.filter(i => i.id !== id);
  saveToLocalStorage();
  renderTimetable();
  showToast('수업이 삭제되었어요 🗑️', 'success');
}


/* ─────────────────────────────────────────
   수업 팝업 (수정 / 삭제 선택)
   ───────────────────────────────────────── */

/**
 * 수업 셀 클릭 시 팝업을 엽니다.
 * @param {string} id - 항목 ID
 */
function openItemPopup(id) {
  const item = timetableItems.find(i => i.id === id);
  if (!item) return;

  currentPopupItemId = id;

  // 팝업 내용 채우기
  const subjectEl = document.getElementById('popupSubjectName');
  subjectEl.textContent  = item.subjectName;
  subjectEl.style.color  = darkenColor(item.color);

  document.getElementById('popupInfo').textContent =
    `${item.day}요일 · ${item.period}${item.classroom ? ' · ' + item.classroom : ''}`;

  // 팝업 & 오버레이 표시
  document.getElementById('itemPopup').style.display   = 'block';
  document.getElementById('popupOverlay').style.display = 'block';
}

/** 팝업의 수정 버튼: 팝업을 닫고 폼에 항목 데이터를 세팅합니다. */
function editItemFromPopup() {
  const id = currentPopupItemId;
  closeItemPopup();
  startEditItem(id);
}

/** 팝업의 삭제 버튼: 확인 후 항목을 삭제합니다. */
function deleteItemFromPopup() {
  const item = timetableItems.find(i => i.id === currentPopupItemId);
  if (!item) return;

  if (confirm(`'${item.subjectName}' 수업을 삭제할까요?`)) {
    deleteItem(currentPopupItemId);
    closeItemPopup();
  }
}

/** 팝업을 닫습니다. */
function closeItemPopup() {
  document.getElementById('itemPopup').style.display    = 'none';
  document.getElementById('popupOverlay').style.display = 'none';
  currentPopupItemId = null;
}


/* ─────────────────────────────────────────
   과목 관리
   ───────────────────────────────────────── */

/**
 * 과목 드롭다운(select)을 다시 렌더링합니다.
 * - visible=true인 과목만 포함
 * - 가나다순 정렬
 */
function renderSubjectDropdown() {
  const select = document.getElementById('inputSubject');
  const prevValue = select.value;

  // visible 과목만 가나다순 정렬
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

  visibleSubjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value       = s.name;
    opt.textContent = s.name;
    select.appendChild(opt);
  });

  // 이전에 선택된 과목 복원 (가능하면)
  if (prevValue && visibleSubjects.some(s => s.name === prevValue)) {
    select.value = prevValue;
  }

  // 현재 선택 과목에 맞는 색상 자동 반영
  handleSubjectChange();
}

/**
 * 과목 목록 칩을 다시 렌더링합니다.
 * - 가나다순 정렬
 * - 숨겨진 과목은 취소선 + 연하게 표시
 * - ✕ 또는 ↩ 버튼으로 표시/숨김 토글
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
              title="${s.visible ? '드롭다운에서 숨기기' : '드롭다운에 다시 표시'}"
              aria-label="${s.visible ? '숨기기' : '다시 표시'}">
        ${s.visible ? '✕' : '↩'}
      </button>
    </div>
  `).join('');
}

/**
 * 새 과목을 추가합니다.
 * - 중복 이름 방지
 * - 사용되지 않은 파스텔 색상 자동 배정
 */
function addSubject() {
  const input = document.getElementById('newSubjectInput');
  const name  = input.value.trim();

  if (!name) {
    showToast('과목명을 입력해주세요 📝', 'error');
    input.focus();
    return;
  }

  // 중복 확인
  if (subjects.some(s => s.name === name)) {
    showToast('이미 등록된 과목이에요! 😅', 'error');
    input.select();
    return;
  }

  // 아직 사용되지 않은 색상 자동 배정
  const usedColors     = new Set(subjects.map(s => s.color));
  const available      = PASTEL_COLORS.find(c => !usedColors.has(c.hex));
  const assignedColor  = available
    ? available.hex
    : PASTEL_COLORS[subjects.length % PASTEL_COLORS.length].hex;

  subjects.push({
    id:      generateId(),
    name,
    color:   assignedColor,
    visible: true,
  });

  input.value = '';
  saveToLocalStorage();
  renderSubjectList();
  renderSubjectDropdown();
  showToast(`'${name}' 과목이 추가되었어요! 📚`, 'success');
}

/**
 * 과목의 visible 상태를 토글합니다.
 * 숨겨진 과목은 드롭다운에서 제거되고, 칩에 취소선이 그어집니다.
 * @param {string} id - 과목 ID
 */
function toggleSubjectVisibility(id) {
  const subject = subjects.find(s => s.id === id);
  if (!subject) return;

  subject.visible = !subject.visible;

  saveToLocalStorage();
  renderSubjectList();
  renderSubjectDropdown();

  const action = subject.visible ? '다시 표시했어요 👀' : '목록에서 숨겼어요 🙈';
  showToast(`'${subject.name}'을(를) ${action}`, 'success');
}


/* ─────────────────────────────────────────
   색상 선택기
   ───────────────────────────────────────── */

/**
 * 색상 선택기 UI를 렌더링합니다.
 * PASTEL_COLORS의 15개 색상 버튼을 생성합니다.
 */
function renderColorPicker() {
  const picker = document.getElementById('colorPicker');
  picker.innerHTML = PASTEL_COLORS.map(c => `
    <button type="button"
            class="color-swatch"
            style="background-color: ${c.hex};"
            title="${c.name}"
            onclick="selectColor('${c.hex}')"
            data-color="${c.hex}"
            aria-label="${c.name} 선택">
    </button>
  `).join('');
}

/**
 * 색상을 선택합니다.
 * 선택된 색상 버튼에 .selected 클래스를 부여합니다.
 * @param {string} hex - 색상 hex 코드
 */
function selectColor(hex) {
  // hidden input에 저장
  document.getElementById('selectedColor').value = hex;

  // 선택된 버튼 강조
  document.querySelectorAll('.color-swatch').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === hex);
  });
}


/* ─────────────────────────────────────────
   저장 / 불러오기 (스냅샷)
   ───────────────────────────────────────── */

/**
 * 현재 시간표를 타임스탬프 기반 이름으로 스냅샷에 저장합니다.
 * 예: "2026-03-07 14:30 저장본"
 */
function saveSnapshot() {
  const now    = new Date();
  const name   = `${formatDate(now)} 저장본`;
  const id     = generateId();

  const snapshot = {
    id,
    name,
    savedAt:  now.toISOString(),
    items:    JSON.parse(JSON.stringify(timetableItems)),
    subjects: JSON.parse(JSON.stringify(subjects)),
  };

  snapshots.push(snapshot);
  lastSnapshotId = id;

  saveToLocalStorage();
  showToast(`✨ '${name}'으로 저장되었어요!`, 'success');
}

/**
 * 저장된 스냅샷 목록을 보여주는 모달을 엽니다.
 */
function openLoadModal() {
  renderSnapshotList();
  document.getElementById('loadModal').style.display = 'flex';
}

/** 불러오기 모달을 닫습니다. */
function closeLoadModal() {
  document.getElementById('loadModal').style.display = 'none';
}

/**
 * 모달 바깥쪽(overlay)을 클릭하면 모달을 닫습니다.
 * @param {MouseEvent} event
 */
function closeLoadModalOutside(event) {
  if (event.target === document.getElementById('loadModal')) {
    closeLoadModal();
  }
}

/**
 * 스냅샷 목록 UI를 렌더링합니다.
 * 최신순 정렬, 현재 불러온 스냅샷은 '현재' 배지 표시.
 */
function renderSnapshotList() {
  const listEl = document.getElementById('snapshotList');

  if (snapshots.length === 0) {
    listEl.innerHTML = `
      <p class="empty-snapshots">
        저장된 시간표가 없어요 😥<br />
        상단의 '저장하기' 버튼을 눌러 저장해보세요!
      </p>
    `;
    return;
  }

  // 최신순 정렬
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
  );

  listEl.innerHTML = sorted.map(snap => `
    <div class="snapshot-item ${snap.id === lastSnapshotId ? 'current' : ''}">
      <div class="snapshot-info">
        <span class="snapshot-name">${escapeHtml(snap.name)}</span>
        <span class="snapshot-count">${snap.items.length}개 수업</span>
        ${snap.id === lastSnapshotId
          ? '<span class="snapshot-badge">현재</span>'
          : ''}
      </div>
      <div class="snapshot-buttons">
        <button class="btn btn-small btn-primary"
                onclick="loadSnapshot('${snap.id}')">불러오기</button>
        <button class="btn btn-small btn-danger"
                onclick="deleteSnapshot('${snap.id}')">삭제</button>
      </div>
    </div>
  `).join('');
}

/**
 * 스냅샷을 불러와서 현재 시간표를 교체합니다.
 * @param {string} id - 스냅샷 ID
 */
function loadSnapshot(id) {
  const snap = snapshots.find(s => s.id === id);
  if (!snap) return;

  // 현재 시간표와 과목 목록을 스냅샷으로 교체
  timetableItems = JSON.parse(JSON.stringify(snap.items));
  subjects       = JSON.parse(JSON.stringify(snap.subjects));
  lastSnapshotId = id;

  saveToLocalStorage();
  renderTimetable();
  renderSubjectList();
  renderSubjectDropdown();
  closeLoadModal();

  showToast(`📂 '${snap.name}'을(를) 불러왔어요!`, 'success');
}

/**
 * 스냅샷을 삭제합니다.
 * @param {string} id - 스냅샷 ID
 */
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


/* ─────────────────────────────────────────
   출력
   ───────────────────────────────────────── */

/**
 * 브라우저 인쇄 다이얼로그를 엽니다.
 * @media print 스타일이 자동으로 적용됩니다.
 */
function printTimetable() {
  window.print();
}


/* ─────────────────────────────────────────
   유틸리티 함수
   ───────────────────────────────────────── */

/**
 * 고유 ID를 생성합니다 (base36 타임스탬프 + 난수).
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Date 객체를 "YYYY-MM-DD HH:MM" 형식 문자열로 변환합니다.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const Y   = date.getFullYear();
  const M   = String(date.getMonth() + 1).padStart(2, '0');
  const D   = String(date.getDate()).padStart(2, '0');
  const h   = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${min}`;
}

/**
 * HTML 특수문자를 이스케이프하여 XSS를 방지합니다.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/**
 * 파스텔 색상에서 텍스트용 더 어두운 색을 반환합니다.
 * 팝업 과목명 강조 표시에 사용됩니다.
 * @param {string} hex - "#RRGGBB" 형식
 * @returns {string} rgb() 형식 색상 문자열
 */
function darkenColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.55; // 밝기 감소 비율
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

/**
 * 화면 하단에 토스트 알림 메시지를 표시합니다.
 * 3초 후 자동으로 사라집니다.
 * @param {string} message - 표시할 메시지
 * @param {'success'|'error'} [type='success'] - 알림 종류
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = `toast toast-${type} show`;

  // 이전 타이머 취소 (연속 호출 대응)
  if (showToast._timer) clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}


/* ─────────────────────────────────────────
   이벤트 등록
   ───────────────────────────────────────── */

// DOM이 완전히 로드된 뒤 초기화 실행
document.addEventListener('DOMContentLoaded', init);

// ESC 키로 열린 팝업/모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('itemPopup').style.display === 'block') {
      closeItemPopup();
    }
    if (document.getElementById('loadModal').style.display === 'flex') {
      closeLoadModal();
    }
  }
});
