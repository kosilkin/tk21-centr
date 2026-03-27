import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const config = window.APP_CONFIG || {};
const supabaseUrl = config.SUPABASE_URL;
const supabaseAnonKey = config.SUPABASE_ANON_KEY;

const statusBanner = document.getElementById('statusBanner');
const jobsGrid = document.getElementById('jobsGrid');
const teamGrid = document.getElementById('teamGrid');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthTitle = document.getElementById('calendarMonthTitle');
const eventsSummaryList = document.getElementById('eventsSummaryList');
const directionsGrid = document.getElementById('directionsGrid');

const jobsEmpty = document.getElementById('jobsEmpty');
const teamEmpty = document.getElementById('teamEmpty');
const eventsEmpty = document.getElementById('eventsEmpty');
const directionsEmpty = document.getElementById('directionsEmpty');

const jobsCountBadge = document.getElementById('jobsCountBadge');
const teamCountBadge = document.getElementById('teamCountBadge');
const directionsCountBadge = document.getElementById('directionsCountBadge');

const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');

const adminModal = document.getElementById('adminModal');
const openAdminBtn = document.getElementById('openAdminBtn');
const closeAdminBtn = document.getElementById('closeAdminBtn');
const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const adminEmail = document.getElementById('adminEmail');
const adminPassword = document.getElementById('adminPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const adminUserLabel = document.getElementById('adminUserLabel');

const jobsAdminList = document.getElementById('jobsAdminList');
const eventsAdminList = document.getElementById('eventsAdminList');
const membersAdminList = document.getElementById('membersAdminList');
const directionsAdminList = document.getElementById('directionsAdminList');

const jobTitle = document.getElementById('jobTitle');
const jobDirection = document.getElementById('jobDirection');
const jobDesc = document.getElementById('jobDesc');
const jobLink = document.getElementById('jobLink');
const saveJobBtn = document.getElementById('saveJobBtn');
const cancelJobEditBtn = document.getElementById('cancelJobEditBtn');
const jobEditNote = document.getElementById('jobEditNote');

const eventTitle = document.getElementById('eventTitle');
const eventYear = document.getElementById('eventYear');
const eventMonth = document.getElementById('eventMonth');
const eventDate = document.getElementById('eventDate');
const eventTime = document.getElementById('eventTime');
const eventPlace = document.getElementById('eventPlace');
const eventColor = document.getElementById('eventColor');
const saveEventBtn = document.getElementById('saveEventBtn');
const cancelEventEditBtn = document.getElementById('cancelEventEditBtn');
const eventEditNote = document.getElementById('eventEditNote');

const memberName = document.getElementById('memberName');
const memberRole = document.getElementById('memberRole');
const memberDesc = document.getElementById('memberDesc');
const memberPhoto = document.getElementById('memberPhoto');
const saveMemberBtn = document.getElementById('saveMemberBtn');
const cancelMemberEditBtn = document.getElementById('cancelMemberEditBtn');
const memberEditNote = document.getElementById('memberEditNote');

const directionName = document.getElementById('directionName');
const directionSub = document.getElementById('directionSub');
const directionJobs = document.getElementById('directionJobs');
const saveDirectionBtn = document.getElementById('saveDirectionBtn');
const cancelDirectionEditBtn = document.getElementById('cancelDirectionEditBtn');
const directionEditNote = document.getElementById('directionEditNote');

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

let supabase = null;
let state = {
  jobs: [],
  events: [],
  members: [],
  directions: []
};

let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();
let editingJobId = null;
let editingEventId = null;
let editingMemberId = null;
let editingDirectionId = null;
let authListener = null;

function fillMonthSelect() {
  eventMonth.innerHTML = MONTH_NAMES.map((name, index) => `<option value="${index}">${name}</option>`).join('');
}

function showStatus(message, isError = false) {
  statusBanner.textContent = message;
  statusBanner.classList.remove('hidden');
  statusBanner.style.background = isError
    ? 'linear-gradient(135deg, #ffd2d2, #ffb1b1)'
    : 'linear-gradient(135deg, #fff4ca, #ffe3a3)';
  statusBanner.style.color = isError ? '#7a1d1d' : '#5f4700';
}

function hideStatus() {
  statusBanner.classList.add('hidden');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}

function shortEventTitle(title) {
  const value = String(title || '');
  return value.length > 18 ? value.slice(0, 18) + '…' : value;
}

function getColorClass(color) {
  if (color === 'orange') return 'event-orange';
  if (color === 'green') return 'event-green';
  return 'event-blue';
}

function normalizeDirectionJobs(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split('\n').map(v => v.trim()).filter(Boolean);
    }
  }
  return [];
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEventRecord(event) {
  return {
    ...event,
    year: toNumber(event?.year),
    month: toNumber(event?.month),
    day: toNumber(event?.day),
    event_time: String(event?.event_time || ''),
    place: String(event?.place || ''),
    color: event?.color || 'blue'
  };
}

function readErrorMessage(error, fallback = 'Неизвестная ошибка') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const message = String(error.message || error.error_description || error.details || fallback);
  const lower = message.toLowerCase();

  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Нет связи с Supabase. Проверьте URL проекта, ключ и доступность сети.';
  }

  return message;
}

function renderJobs() {
  jobsGrid.innerHTML = '';
  jobsCountBadge.textContent = `${state.jobs.length} вакансий`;
  jobsEmpty.classList.toggle('hidden', state.jobs.length > 0);

  state.jobs.forEach(job => {
    const card = document.createElement('div');
    card.className = 'job-card';
    card.innerHTML = `
      <div class="job-tag">${escapeHtml(job.direction)}</div>
      <h3 class="job-title">${escapeHtml(job.title)}</h3>
      <p class="job-text">${escapeHtml(job.description)}</p>
      <a href="${escapeHtml(job.form_link || '#')}" class="job-btn" target="_blank" rel="noopener noreferrer">Откликнуться</a>
    `;
    jobsGrid.appendChild(card);
  });
}

function renderTeam() {
  teamGrid.innerHTML = '';
  teamCountBadge.textContent = `${state.members.length} сотрудников`;
  teamEmpty.classList.toggle('hidden', state.members.length > 0);

  state.members.forEach(member => {
    const photoStyle = member.photo_url ? `background-image:url('${member.photo_url.replaceAll("'", "\\'")}');` : '';
    const photoClass = member.photo_url ? 'team-photo' : 'team-photo placeholder';
    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div class="team-top">
        <div class="${photoClass}" style="${photoStyle}">
          ${member.photo_url ? '' : `<span style="position:relative;z-index:2;">${escapeHtml(getInitials(member.full_name))}</span>`}
        </div>
        <div>
          <h3 class="team-name">${escapeHtml(member.full_name)}</h3>
          <div class="team-role">${escapeHtml(member.role)}</div>
        </div>
      </div>
      <p class="team-desc">${escapeHtml(member.description)}</p>
    `;
    teamGrid.appendChild(card);
  });
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  eventsSummaryList.innerHTML = '';
  calendarMonthTitle.textContent = `${MONTH_NAMES[currentCalendarMonth]} ${currentCalendarYear}`;

  const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentCalendarYear, currentCalendarMonth, 0).getDate();

  for (let i = 0; i < firstWeekDay; i++) {
    const prevDayNumber = daysInPrevMonth - firstWeekDay + i + 1;
    const cell = document.createElement('div');
    cell.className = 'day muted';
    cell.innerHTML = `<div class="day-number">${prevDayNumber}</div>`;
    calendarGrid.appendChild(cell);
  }

  const monthEvents = state.events
    .map(normalizeEventRecord)
    .filter(e => e.year === currentCalendarYear && e.month === currentCalendarMonth)
    .sort((a, b) => a.day - b.day || (a.event_time || '').localeCompare(b.event_time || ''));

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = monthEvents.filter(e => e.day === day);
    const cell = document.createElement('div');
    cell.className = 'day';

    let eventsHtml = '';
    if (dayEvents.length) {
      const visible = dayEvents.slice(0, 2);
      eventsHtml += '<div class="day-events">';
      visible.forEach(event => {
        eventsHtml += `
          <span class="mini-event ${getColorClass(event.color)}">
            ${escapeHtml(event.event_time)} · ${escapeHtml(shortEventTitle(event.title))}
          </span>
        `;
      });
      if (dayEvents.length > 2) {
        eventsHtml += `<span class="event-more">+${dayEvents.length - 2} событие</span>`;
      }
      eventsHtml += '</div>';
    }

    cell.innerHTML = `<div class="day-number">${day}</div>${eventsHtml}`;
    calendarGrid.appendChild(cell);
  }

  const usedCells = firstWeekDay + daysInMonth;
  const tailCells = Math.ceil(usedCells / 7) * 7 - usedCells;

  for (let i = 1; i <= tailCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'day muted';
    cell.innerHTML = `<div class="day-number">${i}</div>`;
    calendarGrid.appendChild(cell);
  }

  eventsEmpty.classList.toggle('hidden', monthEvents.length > 0);

  monthEvents.forEach(event => {
    const row = document.createElement('div');
    row.className = 'summary-item';
    row.innerHTML = `
      <span class="summary-dot ${getColorClass(event.color)}"></span>
      <div class="summary-text">
        <b>${event.day} ${MONTH_NAMES[event.month].toLowerCase()}, ${escapeHtml(event.event_time)}</b><br>
        ${escapeHtml(event.title)} — ${escapeHtml(event.place)}
      </div>
    `;
    eventsSummaryList.appendChild(row);
  });
}

function renderDirections() {
  directionsGrid.innerHTML = '';
  directionsCountBadge.textContent = `${state.directions.length} направлений`;
  directionsEmpty.classList.toggle('hidden', state.directions.length > 0);

  state.directions.forEach(direction => {
    const jobs = normalizeDirectionJobs(direction.jobs);
    const card = document.createElement('div');
    card.className = 'direction-card';
    card.innerHTML = `
      <div class="direction-top">
        <h3 class="direction-title">${escapeHtml(direction.name)}</h3>
        <p class="direction-sub">${escapeHtml(direction.subtitle)}</p>
      </div>
      <div class="direction-body">
        ${jobs.map(job => `<div class="mini-job-row">${escapeHtml(job)}</div>`).join('')}
      </div>
    `;
    directionsGrid.appendChild(card);
  });
}

function renderJobsAdmin() {
  jobsAdminList.innerHTML = '';
  state.jobs.forEach((job, index) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <h4 class="item-title">${escapeHtml(job.title)}</h4>
      <p class="item-text"><b>Направление:</b> ${escapeHtml(job.direction)}</p>
      <p class="item-text">${escapeHtml(job.description)}</p>
      <div class="item-actions">
        <button class="small-btn" onclick="window.startEditJob('${job.id}')">Редактировать</button>
        <button class="small-btn delete" onclick="window.deleteJob('${job.id}')">Удалить</button>
      </div>
    `;
    jobsAdminList.appendChild(item);
  });
}

function renderEventsAdmin() {
  eventsAdminList.innerHTML = '';
  state.events.map(normalizeEventRecord).forEach(event => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <h4 class="item-title">${escapeHtml(event.title)}</h4>
      <p class="item-text"><b>Дата:</b> ${event.day} ${MONTH_NAMES[event.month].toLowerCase()} ${event.year}, ${escapeHtml(event.event_time)}</p>
      <p class="item-text"><b>Место:</b> ${escapeHtml(event.place)}</p>
      <div class="item-actions">
        <button class="small-btn" onclick="window.startEditEvent('${event.id}')">Редактировать</button>
        <button class="small-btn delete" onclick="window.deleteEvent('${event.id}')">Удалить</button>
      </div>
    `;
    eventsAdminList.appendChild(item);
  });
}

function renderMembersAdmin() {
  membersAdminList.innerHTML = '';
  state.members.forEach(member => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <h4 class="item-title">${escapeHtml(member.full_name)}</h4>
      <p class="item-text"><b>Должность:</b> ${escapeHtml(member.role)}</p>
      <p class="item-text">${escapeHtml(member.description)}</p>
      <div class="item-actions">
        <button class="small-btn" onclick="window.startEditMember('${member.id}')">Редактировать</button>
        <button class="small-btn delete" onclick="window.deleteMember('${member.id}')">Удалить</button>
      </div>
    `;
    membersAdminList.appendChild(item);
  });
}

function renderDirectionsAdmin() {
  directionsAdminList.innerHTML = '';
  state.directions.forEach(direction => {
    const jobs = normalizeDirectionJobs(direction.jobs);
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <h4 class="item-title">${escapeHtml(direction.name)}</h4>
      <p class="item-text"><b>Описание:</b> ${escapeHtml(direction.subtitle)}</p>
      <p class="item-text"><b>Вакансии:</b><br>${jobs.map(j => escapeHtml(j)).join('<br>')}</p>
      <div class="item-actions">
        <button class="small-btn" onclick="window.startEditDirection('${direction.id}')">Редактировать</button>
        <button class="small-btn delete" onclick="window.deleteDirection('${direction.id}')">Удалить</button>
      </div>
    `;
    directionsAdminList.appendChild(item);
  });
}

function renderAll() {
  renderJobs();
  renderTeam();
  renderCalendar();
  renderDirections();
  renderJobsAdmin();
  renderEventsAdmin();
  renderMembersAdmin();
  renderDirectionsAdmin();
}

function clearJobForm() {
  jobTitle.value = '';
  jobDirection.value = '';
  jobDesc.value = '';
  jobLink.value = '';
  editingJobId = null;
  jobEditNote.textContent = '';
  saveJobBtn.textContent = 'Сохранить';
}

function clearEventForm() {
  eventTitle.value = '';
  eventYear.value = currentCalendarYear;
  eventMonth.value = String(currentCalendarMonth);
  eventDate.value = '';
  eventTime.value = '';
  eventPlace.value = '';
  eventColor.value = 'blue';
  editingEventId = null;
  eventEditNote.textContent = '';
  saveEventBtn.textContent = 'Сохранить';
}

function clearMemberForm() {
  memberName.value = '';
  memberRole.value = '';
  memberDesc.value = '';
  memberPhoto.value = '';
  editingMemberId = null;
  memberEditNote.textContent = '';
  saveMemberBtn.textContent = 'Сохранить';
}

function clearDirectionForm() {
  directionName.value = '';
  directionSub.value = '';
  directionJobs.value = '';
  editingDirectionId = null;
  directionEditNote.textContent = '';
  saveDirectionBtn.textContent = 'Сохранить';
}

async function loadAllData() {
  if (!supabase) return;

  try {
    const [jobsRes, eventsRes, membersRes, directionsRes] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('*').order('year', { ascending: true }).order('month', { ascending: true }).order('day', { ascending: true }).order('event_time', { ascending: true }),
      supabase.from('team_members').select('*').order('created_at', { ascending: true }),
      supabase.from('directions').select('*').order('created_at', { ascending: true })
    ]);

    state.jobs = jobsRes.data || [];
    state.events = (eventsRes.data || []).map(normalizeEventRecord);
    state.members = membersRes.data || [];
    state.directions = directionsRes.data || [];

    const errors = [
      jobsRes.error && `Вакансии: ${readErrorMessage(jobsRes.error)}`,
      eventsRes.error && `События: ${readErrorMessage(eventsRes.error)}`,
      membersRes.error && `Команда: ${readErrorMessage(membersRes.error)}`,
      directionsRes.error && `Направления: ${readErrorMessage(directionsRes.error)}`
    ].filter(Boolean);

    if (errors.length) {
      showStatus(`Часть данных не загружена. ${errors.join(' | ')}`, true);
    } else {
      hideStatus();
    }

    renderAll();
  } catch (error) {
    showStatus(`Ошибка соединения с базой: ${readErrorMessage(error)}`, true);
  }
}

async function saveJob() {
  const title = jobTitle.value.trim();
  const direction = jobDirection.value.trim();
  const description = jobDesc.value.trim();
  const form_link = jobLink.value.trim() || '#';
  if (!title || !direction || !description) return;

  const payload = { title, direction, description, form_link };
  let res;

  if (editingJobId) {
    res = await supabase.from('jobs').update(payload).eq('id', editingJobId);
  } else {
    res = await supabase.from('jobs').insert(payload);
  }

  if (res.error) {
    showStatus(`Не удалось сохранить вакансию: ${res.error.message}`, true);
    return;
  }

  clearJobForm();
  await loadAllData();
}

async function saveEvent() {
  const title = eventTitle.value.trim();
  const year = Number(eventYear.value);
  const month = Number(eventMonth.value);
  const day = Number(eventDate.value);
  const event_time = eventTime.value.trim();
  const place = eventPlace.value.trim();
  const color = eventColor.value;
  if (!title || !year || Number.isNaN(month) || !day || !event_time || !place) return;

  const payload = { title, year, month, day, event_time, place, color };
  let res;

  if (editingEventId) {
    res = await supabase.from('events').update(payload).eq('id', editingEventId);
  } else {
    res = await supabase.from('events').insert(payload);
  }

  if (res.error) {
    showStatus(`Не удалось сохранить событие: ${res.error.message}`, true);
    return;
  }

  clearEventForm();
  currentCalendarYear = year;
  currentCalendarMonth = month;
  await loadAllData();
}

async function saveMember() {
  const full_name = memberName.value.trim();
  const role = memberRole.value.trim();
  const description = memberDesc.value.trim();
  const photo_url = memberPhoto.value.trim();
  if (!full_name || !role || !description) return;

  const payload = { full_name, role, description, photo_url };
  let res;

  if (editingMemberId) {
    res = await supabase.from('team_members').update(payload).eq('id', editingMemberId);
  } else {
    res = await supabase.from('team_members').insert(payload);
  }

  if (res.error) {
    showStatus(`Не удалось сохранить сотрудника: ${res.error.message}`, true);
    return;
  }

  clearMemberForm();
  await loadAllData();
}

async function saveDirection() {
  const name = directionName.value.trim();
  const subtitle = directionSub.value.trim();
  const jobs = directionJobs.value.split('\n').map(v => v.trim()).filter(Boolean);
  if (!name || !subtitle || !jobs.length) return;

  const payload = { name, subtitle, jobs };
  let res;

  if (editingDirectionId) {
    res = await supabase.from('directions').update(payload).eq('id', editingDirectionId);
  } else {
    res = await supabase.from('directions').insert(payload);
  }

  if (res.error) {
    showStatus(`Не удалось сохранить направление: ${res.error.message}`, true);
    return;
  }

  clearDirectionForm();
  await loadAllData();
}

function startEditJob(id) {
  const item = state.jobs.find(v => v.id === id);
  if (!item) return;
  editingJobId = id;
  jobTitle.value = item.title || '';
  jobDirection.value = item.direction || '';
  jobDesc.value = item.description || '';
  jobLink.value = item.form_link || '';
  jobEditNote.textContent = `Редактируется: ${item.title}`;
  saveJobBtn.textContent = 'Обновить';
}

function startEditEvent(id) {
  const item = state.events.find(v => v.id === id);
  if (!item) return;
  editingEventId = id;
  eventTitle.value = item.title || '';
  eventYear.value = item.year || '';
  eventMonth.value = String(item.month ?? currentCalendarMonth);
  eventDate.value = item.day || '';
  eventTime.value = item.event_time || '';
  eventPlace.value = item.place || '';
  eventColor.value = item.color || 'blue';
  eventEditNote.textContent = `Редактируется: ${item.title}`;
  saveEventBtn.textContent = 'Обновить';
}

function startEditMember(id) {
  const item = state.members.find(v => v.id === id);
  if (!item) return;
  editingMemberId = id;
  memberName.value = item.full_name || '';
  memberRole.value = item.role || '';
  memberDesc.value = item.description || '';
  memberPhoto.value = item.photo_url || '';
  memberEditNote.textContent = `Редактируется: ${item.full_name}`;
  saveMemberBtn.textContent = 'Обновить';
}

function startEditDirection(id) {
  const item = state.directions.find(v => v.id === id);
  if (!item) return;
  editingDirectionId = id;
  directionName.value = item.name || '';
  directionSub.value = item.subtitle || '';
  directionJobs.value = normalizeDirectionJobs(item.jobs).join('\n');
  directionEditNote.textContent = `Редактируется: ${item.name}`;
  saveDirectionBtn.textContent = 'Обновить';
}

async function deleteJob(id) {
  const res = await supabase.from('jobs').delete().eq('id', id);
  if (res.error) {
    showStatus(`Не удалось удалить вакансию: ${res.error.message}`, true);
    return;
  }
  if (editingJobId === id) clearJobForm();
  await loadAllData();
}

async function deleteEvent(id) {
  const res = await supabase.from('events').delete().eq('id', id);
  if (res.error) {
    showStatus(`Не удалось удалить событие: ${res.error.message}`, true);
    return;
  }
  if (editingEventId === id) clearEventForm();
  await loadAllData();
}

async function deleteMember(id) {
  const res = await supabase.from('team_members').delete().eq('id', id);
  if (res.error) {
    showStatus(`Не удалось удалить сотрудника: ${res.error.message}`, true);
    return;
  }
  if (editingMemberId === id) clearMemberForm();
  await loadAllData();
}

async function deleteDirection(id) {
  const res = await supabase.from('directions').delete().eq('id', id);
  if (res.error) {
    showStatus(`Не удалось удалить направление: ${res.error.message}`, true);
    return;
  }
  if (editingDirectionId === id) clearDirectionForm();
  await loadAllData();
}

function changeMonth(step) {
  currentCalendarMonth += step;
  if (currentCalendarMonth < 0) {
    currentCalendarMonth = 11;
    currentCalendarYear--;
  } else if (currentCalendarMonth > 11) {
    currentCalendarMonth = 0;
    currentCalendarYear++;
  }
  renderCalendar();
}

function applyAuthState(userOrSession) {
  const user = userOrSession?.user || userOrSession;

  if (user?.email) {
    loginView.classList.add('hidden');
    adminView.classList.remove('hidden');
    adminUserLabel.textContent = `Вход выполнен: ${user.email}`;
    return;
  }

  adminView.classList.add('hidden');
  loginView.classList.remove('hidden');
  adminUserLabel.textContent = '';
}

async function updateAuthUI() {
  if (!supabase) return;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showStatus(`Ошибка сессии: ${readErrorMessage(error)}`, true);
    return;
  }

  applyAuthState(data.session);
}

async function login() {
  loginError.textContent = '';
  const email = adminEmail.value.trim();
  const password = adminPassword.value;
  if (!email || !password) return;
  if (!supabase) {
    loginError.textContent = 'Supabase не инициализирован. Проверьте config.js.';
    return;
  }

  const initialText = loginBtn.textContent;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Вход...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message = readErrorMessage(error, 'Неизвестная ошибка входа');
      if (message.toLowerCase().includes('invalid login credentials')) {
        loginError.textContent = 'Неверный email или пароль.';
      } else if (message.toLowerCase().includes('email not confirmed')) {
        loginError.textContent = 'Email не подтверждён в Supabase Auth.';
      } else {
        loginError.textContent = message;
      }
      showStatus(`Ошибка входа: ${loginError.textContent}`, true);
      return;
    }

    adminPassword.value = '';

    const signedInUser = data?.session?.user || data?.user || { email };
    applyAuthState(signedInUser);
    showStatus(`Успешный вход: ${signedInUser.email || email}`);
    await loadAllData();
  } catch (error) {
    loginError.textContent = readErrorMessage(error, 'Ошибка входа');
    showStatus(`Ошибка входа: ${loginError.textContent}`, true);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = initialText;
  }
}

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showStatus(`Ошибка выхода: ${error.message}`, true);
    return;
  }
  await updateAuthUI();
}

async function init() {
  fillMonthSelect();
  clearJobForm();
  clearEventForm();
  clearMemberForm();
  clearDirectionForm();

  if (!supabaseUrl || !supabaseAnonKey) {
    showStatus('Нужно создать config.js по образцу config.example.js и вставить URL/anon key Supabase.', true);
    return;
  }

  if (!String(supabaseUrl).startsWith('https://') || String(supabaseAnonKey).length < 20) {
    showStatus('Похоже, в config.js некорректный URL или anon key Supabase.', true);
  }

  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    showStatus(`Ошибка инициализации Supabase: ${readErrorMessage(error)}`, true);
    return;
  }

  openAdminBtn.addEventListener('click', () => adminModal.classList.add('show'));
  closeAdminBtn.addEventListener('click', () => adminModal.classList.remove('show'));
  adminModal.addEventListener('click', (e) => {
    if (e.target === adminModal) adminModal.classList.remove('show');
  });

  loginBtn.addEventListener('click', login);
  adminPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });
  logoutBtn.addEventListener('click', logout);
  refreshBtn.addEventListener('click', loadAllData);

  saveJobBtn.addEventListener('click', saveJob);
  saveEventBtn.addEventListener('click', saveEvent);
  saveMemberBtn.addEventListener('click', saveMember);
  saveDirectionBtn.addEventListener('click', saveDirection);

  cancelJobEditBtn.addEventListener('click', clearJobForm);
  cancelEventEditBtn.addEventListener('click', clearEventForm);
  cancelMemberEditBtn.addEventListener('click', clearMemberForm);
  cancelDirectionEditBtn.addEventListener('click', clearDirectionForm);

  prevMonthBtn.addEventListener('click', () => changeMonth(-1));
  nextMonthBtn.addEventListener('click', () => changeMonth(1));

  if (authListener?.subscription) {
    authListener.subscription.unsubscribe();
  }
  authListener = supabase.auth.onAuthStateChange(async () => {
    try {
      await updateAuthUI();
    } catch (error) {
      showStatus(`Ошибка обновления авторизации: ${readErrorMessage(error)}`, true);
    }
  });

  await updateAuthUI();
  await loadAllData();
}

window.addEventListener('unhandledrejection', (event) => {
  showStatus(`Непойманная ошибка: ${readErrorMessage(event.reason)}`, true);
});

window.addEventListener('error', (event) => {
  showStatus(`Ошибка приложения: ${readErrorMessage(event.error || event.message)}`, true);
});

window.startEditJob = startEditJob;
window.startEditEvent = startEditEvent;
window.startEditMember = startEditMember;
window.startEditDirection = startEditDirection;
window.deleteJob = deleteJob;
window.deleteEvent = deleteEvent;
window.deleteMember = deleteMember;
window.deleteDirection = deleteDirection;

init();
