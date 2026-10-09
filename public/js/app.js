/* ══════════════════════════════════════════════════
   EduNest — Frontend Application Logic
   Auth · Dashboard · Students · Attendance · Marks
   Fees · Parent Alerts · Timetable · Notices · Chat · Settings
══════════════════════════════════════════════════ */

const API = '';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem('edunest_token'); }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, {
    ...opts,
    headers: { ...headers, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401 && !path.startsWith('/api/auth/login')) {
    showLogin();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function showLogin() {
  localStorage.removeItem('edunest_token');
  document.getElementById('app').hidden = true;
  document.getElementById('login-screen').style.display = 'flex';
}

async function submitLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const res = await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('edunest_token', data.token);
    enterApp(data.user);
  } catch (err) {
    errEl.textContent = err.message;
  }
  return false;
}

function enterApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').hidden = false;
  if (user) {
    document.getElementById('user-name').textContent = user.username;
    document.getElementById('user-role').textContent = user.role || 'User';
    document.getElementById('user-avatar').textContent = user.username.slice(0, 2).toUpperCase();
  }
  navigate('dashboard');
}

function logout() {
  showLogin();
  toast('Signed out');
}

async function boot() {
  if (!getToken()) return showLogin();
  try {
    const me = await api('/api/auth/me');
    enterApp(me);
  } catch {
    showLogin();
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

const PAGE_TITLES = {
  dashboard: 'Dashboard', students: 'Students', attendance: 'Attendance',
  marks: 'Marks & Grades', fees: 'Fees Management', reports: 'Parent Alerts',
  timetable: 'Timetable', notices: 'Notice Board', chat: 'Chat Support', settings: 'Settings'
};

function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;

  const content = document.getElementById('content');
  content.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text3)">Loading…</div>';

  const pages = { dashboard, students, attendance, marks, fees, reports, timetable, notices, chat, settings };
  const fn = pages[page];
  if (fn) fn().catch(err => {
    content.innerHTML = `<div style="padding:60px;text-align:center;color:var(--red)">${err.message}</div>`;
  });

  if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => el.className = 'toast', 3200);
}

function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const todayStr = () => new Date().toISOString().split('T')[0];

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Message copied — paste into WhatsApp/SMS', 'success');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Message copied', 'success');
  }
}

function downloadCsv(entity) {
  fetch(API + `/api/export/${entity}.csv`, { headers: { Authorization: 'Bearer ' + getToken() } })
    .then(r => { if (!r.ok) throw new Error('Export failed'); return r.blob(); })
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${entity}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast(`${entity}.csv downloaded`, 'success');
    })
    .catch(e => toast(e.message, 'error'));
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function dashboard() {
  const [stats, notices_data, students_data] = await Promise.all([
    api('/api/stats'), api('/api/notices'), api('/api/students')
  ]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const attendanceReady = stats.markedToday;

  document.getElementById('alert-dot').hidden = !(stats.todayAbsent > 0 || stats.overdueFees > 0);

  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>${greet}, Admin ☀</h1>
          <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} — here's what's happening</p>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" onclick="downloadCsv('students')">↓ Students CSV</button>
          <button class="btn btn-primary" onclick="navigate('reports')">⚠ Parent Alerts${(stats.todayAbsent + stats.overdueFees) > 0 ? ` (${stats.todayAbsent + stats.overdueFees})` : ''}</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-icon">◎</span>
          <div class="stat-value">${stats.totalStudents}</div>
          <div class="stat-label">Total Students</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✓</span>
          <div class="stat-value" style="color:var(--green)">${stats.todayPresent}</div>
          <div class="stat-label">${attendanceReady ? 'Present Today' : 'Not Marked Yet'}</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✕</span>
          <div class="stat-value" style="color:${stats.todayAbsent > 0 ? 'var(--red)' : 'var(--text)'}">${stats.todayAbsent}</div>
          <div class="stat-label">Absent Today</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">◉</span>
          <div class="stat-value" style="color:${stats.totalPending > 0 ? 'var(--amber)' : 'var(--green)'}">${inr(stats.totalPending)}</div>
          <div class="stat-label">Fees Pending${stats.overdueFees ? ` · ${stats.overdueFees} overdue` : ''}</div>
        </div>
      </div>

      ${stats.todayAbsent > 0 || stats.overdueFees > 0 ? `
      <div class="alert-banner">
        <span>⚠</span>
        <div>
          <strong>Action needed:</strong>
          ${stats.todayAbsent > 0 ? `${stats.todayAbsent} student${stats.todayAbsent > 1 ? 's' : ''} absent today` : ''}
          ${stats.todayAbsent > 0 && stats.overdueFees ? ' · ' : ''}
          ${stats.overdueFees ? `${stats.overdueFees} fee payment${stats.overdueFees > 1 ? 's' : ''} overdue` : ''}
        </div>
        <button class="btn btn-primary" onclick="navigate('reports')">Open Parent Alerts →</button>
      </div>` : ''}

      <div class="dash-grid">
        <div class="card">
          <div class="card-header">
            <h3>Recent Students</h3>
            <button class="btn btn-ghost" onclick="navigate('students')">View all</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Class</th><th>Status</th></tr></thead>
              <tbody>
                ${students_data.slice(0, 5).map(s => `
                  <tr>
                    <td><div class="student-cell"><div class="avatar">${esc(s.avatar)}</div><span class="td-main">${esc(s.name)}</span></div></td>
                    <td>${esc(s.class)}</td>
                    <td><span class="badge badge-${s.status === 'active' ? 'green' : 'red'}">${esc(s.status)}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Latest Notices</h3>
            <button class="btn btn-ghost" onclick="navigate('notices')">View all</button>
          </div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:12px">
              ${notices_data.slice(0, 3).map(n => `
                <div style="display:flex;gap:12px;align-items:flex-start;padding-bottom:12px;border-bottom:1px solid var(--border)">
                  <div class="notice-dot ${esc(n.priority)}"></div>
                  <div>
                    <div style="font-weight:600;font-size:13.5px;color:var(--text);margin-bottom:2px">${esc(n.title)}</div>
                    <div style="font-size:12px;color:var(--text3)">${esc(n.date)} · <span class="badge badge-${n.priority === 'high' ? 'red' : 'amber'}">${esc(n.type)}</span></div>
                  </div>
                </div>`).join('') || '<p style="color:var(--text3)">No notices yet</p>'}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// ─── Students ─────────────────────────────────────────────────────────────────

async function students() {
  const data = await api('/api/students');
  renderStudents(data);
}

function renderStudents(data) {
  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Students</h1><p>${data.length} enrolled students</p></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" onclick="downloadCsv('students')">↓ CSV</button>
          <button class="btn btn-primary" onclick="addStudentModal()">+ Add Student</button>
        </div>
      </div>
      <div class="filters">
        <input class="search-inline" placeholder="Search by name or roll…" oninput="filterStudents(this.value)" id="student-search" />
        <select class="filter-select" onchange="filterByClass(this.value)">
          <option value="">All Classes</option>
          <option>10-A</option><option>10-B</option><option>10-C</option>
        </select>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table id="students-table">
            <thead><tr><th>Student</th><th>Roll No</th><th>Class</th><th>Guardian</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${data.map(s => studentRow(s)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  window._studentsData = data;
}

function studentRow(s) {
  return `<tr data-id="${s.id}">
    <td><div class="student-cell"><div class="avatar">${esc(s.avatar)}</div><span class="td-main">${esc(s.name)}</span></div></td>
    <td>${esc(s.roll)}</td>
    <td>${esc(s.class)}</td>
    <td>${esc(s.guardian || '—')}</td>
    <td>${esc(s.phone || '—')}</td>
    <td><span class="badge badge-${s.status === 'active' ? 'green' : 'red'}">${esc(s.status)}</span></td>
    <td><div class="action-btns">
      <button class="icon-btn" title="Report card" onclick="studentProfile(${s.id})">▤</button>
      <button class="icon-btn" title="Edit" onclick="editStudentModal(${s.id})">✎</button>
      <button class="icon-btn del" title="Delete" onclick="deleteStudent(${s.id})">✕</button>
    </div></td>
  </tr>`;
}

function filterStudents(q) {
  document.querySelectorAll('#students-table tbody tr').forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

function filterByClass(cls) {
  document.querySelectorAll('#students-table tbody tr').forEach(r => {
    r.style.display = (!cls || r.cells[2].textContent === cls) ? '' : 'none';
  });
}

function studentFormFields(s = {}) {
  return `
    <div class="form-row">
      <div class="form-group"><label>Full Name *</label><input id="f-name" value="${esc(s.name || '')}" placeholder="e.g. Anjali Singh" /></div>
      <div class="form-group"><label>Roll Number *</label><input id="f-roll" value="${esc(s.roll || '')}" placeholder="e.g. CS107" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Class</label>
        <select id="f-class">${['10-A', '10-B', '10-C'].map(c => `<option ${s.class === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Status</label>
        <select id="f-status"><option ${s.status === 'active' ? 'selected' : ''}>active</option><option ${s.status === 'inactive' ? 'selected' : ''}>inactive</option></select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Parent/Guardian Name</label><input id="f-guardian" value="${esc(s.guardian || '')}" placeholder="e.g. Rajesh Sharma" /></div>
      <div class="form-group"><label>Parent Phone (for alerts)</label><input id="f-phone" value="${esc(s.phone || '')}" placeholder="9876543210" /></div>
    </div>
    <div class="form-group"><label>Email</label><input id="f-email" type="email" value="${esc(s.email || '')}" placeholder="student@school.com" /></div>`;
}

function studentPayload() {
  return {
    name: document.getElementById('f-name').value.trim(),
    roll: document.getElementById('f-roll').value.trim(),
    class: document.getElementById('f-class').value,
    status: document.getElementById('f-status').value,
    guardian: document.getElementById('f-guardian').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    email: document.getElementById('f-email').value.trim(),
  };
}

function addStudentModal() {
  openModal(`
    <h2>Add New Student</h2>
    ${studentFormFields()}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitAddStudent()">Add Student</button>
    </div>`);
}

async function submitAddStudent() {
  const payload = studentPayload();
  if (!payload.name || !payload.roll) return toast('Name and Roll are required', 'error');
  try {
    await api('/api/students', { method: 'POST', body: payload });
    closeModal();
    toast('Student added successfully!', 'success');
    students();
  } catch (e) { toast(e.message, 'error'); }
}

async function editStudentModal(id) {
  try {
    const s = await api('/api/students/' + id);
    openModal(`
      <h2>Edit Student</h2>
      ${studentFormFields(s)}
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitEditStudent(${id})">Save Changes</button>
      </div>`);
  } catch (e) { toast(e.message, 'error'); }
}

async function submitEditStudent(id) {
  try {
    await api('/api/students/' + id, { method: 'PUT', body: studentPayload() });
    closeModal();
    toast('Student updated!', 'success');
    students();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteStudent(id) {
  if (!confirm('Delete this student? Their attendance/marks/fees history stays but will show as unknown.')) return;
  try {
    await api('/api/students/' + id, { method: 'DELETE' });
    toast('Student deleted', 'success');
    students();
  } catch (e) { toast(e.message, 'error'); }
}

// Report card
async function studentProfile(id) {
  try {
    const p = await api(`/api/students/${id}/profile`);
    const s = p.student;
    const att = p.attendance, mk = p.marks, fee = p.fees;
    openModal(`
      <h2>Report Card — ${esc(s.name)}</h2>
      <p style="color:var(--text3);margin-bottom:16px">${esc(s.roll)} · ${esc(s.class)} · Guardian: ${esc(s.guardian || '—')} · ${esc(s.phone || '')}</p>
      <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card"><div class="stat-value" style="color:${att.percent >= 75 ? 'var(--green)' : att.percent >= 50 ? 'var(--amber)' : 'var(--red)'}">${att.percent == null ? '—' : att.percent + '%'}</div><div class="stat-label">Attendance (${att.present}/${att.total} present)</div></div>
        <div class="stat-card"><div class="stat-value" style="color:${mk.average >= 60 ? 'var(--green)' : 'var(--amber)'}">${mk.average == null ? '—' : mk.average + '%'}</div><div class="stat-label">Average Score</div></div>
        <div class="stat-card"><div class="stat-value" style="color:${fee.due > 0 ? 'var(--red)' : 'var(--green)'}">${inr(fee.due)}</div><div class="stat-label">Fee Due</div></div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="card-header"><h3>Marks</h3></div>
        <div class="table-wrap">
          <table><thead><tr><th>Subject</th><th>Exam</th><th>Score</th><th>Grade</th></tr></thead>
          <tbody>${mk.records.map(m => `<tr><td>${esc(m.subject)}</td><td>${esc(m.exam)}</td><td>${m.marks}/${m.maxMarks}</td><td><span class="badge badge-blue">${esc(m.grade)}</span></td></tr>`).join('') || '<tr><td colspan="4" style="color:var(--text3)">No marks recorded</td></tr>'}</tbody></table>
        </div>
      </div>`);
  } catch (e) { toast(e.message, 'error'); }
}

// ─── Attendance ───────────────────────────────────────────────────────────────

async function attendance() {
  const date = window._attDate || todayStr();
  window._attDate = date;
  const [allAtt, studentData] = await Promise.all([api('/api/attendance'), api('/api/students')]);
  const attData = allAtt.filter(a => a.date === date);
  const studentMap = {};
  studentData.forEach(s => studentMap[s.id] = s);

  const totalPresent = attData.filter(a => a.status === 'present').length;
  const totalAbsent = attData.filter(a => a.status === 'absent').length;
  const totalLate = attData.filter(a => a.status === 'late').length;
  const pct = attData.length ? Math.round(totalPresent / attData.length * 100) : 0;

  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Attendance</h1><p>${date === todayStr() ? 'Today' : date} — ${attData.length}/${studentData.length} students marked</p></div>
        <div style="display:flex;gap:10px;align-items:center">
          <input type="date" class="search-inline" value="${date}" onchange="window._attDate=this.value;attendance()" style="width:170px" />
          <button class="btn btn-ghost" onclick="downloadCsv('attendance')">↓ CSV</button>
          <button class="btn btn-primary" onclick="bulkAttendanceModal()">✓ Mark All Students</button>
        </div>
      </div>

      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
        <div class="stat-card"><span class="stat-icon">✓</span><div class="stat-value" style="color:var(--green)">${totalPresent}</div><div class="stat-label">Present</div></div>
        <div class="stat-card"><span class="stat-icon">✕</span><div class="stat-value" style="color:var(--red)">${totalAbsent}</div><div class="stat-label">Absent</div></div>
        <div class="stat-card"><span class="stat-icon">◷</span><div class="stat-value" style="color:var(--amber)">${totalLate}</div><div class="stat-label">Late</div></div>
        <div class="stat-card"><span class="stat-icon">%</span><div class="stat-value">${attData.length ? pct + '%' : '—'}</div><div class="stat-label">Attendance Rate</div></div>
      </div>

      ${totalAbsent > 0 ? `<div class="alert-banner"><span>⚠</span><div><strong>${totalAbsent} absent</strong> — notify parents from the Parent Alerts page.</div><button class="btn btn-primary" onclick="navigate('reports')">Open Parent Alerts →</button></div>` : ''}

      <div class="card">
        <div class="card-header"><h3>Records for ${date}</h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Subject</th><th>Status</th></tr></thead>
            <tbody>
              ${attData.map(a => {
                const s = studentMap[a.studentId];
                const badgeMap = { present: 'green', absent: 'red', late: 'amber' };
                return `<tr>
                  <td><div class="student-cell"><div class="avatar">${esc(s?.avatar || '??')}</div><span class="td-main">${esc(s?.name || 'Unknown')}</span></div></td>
                  <td>${esc(a.subject)}</td>
                  <td><span class="badge badge-${badgeMap[a.status] || 'blue'}">${esc(a.status)}</span></td>
                </tr>`;
              }).join('') || '<tr><td colspan="3" style="color:var(--text3);padding:20px">No attendance marked for this date — use "Mark All Students".</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function bulkAttendanceModal() {
  const date = window._attDate || todayStr();
  api('/api/students').then(studentData => {
    openModal(`
      <h2>Mark Attendance — ${date}</h2>
      <div class="form-row">
        <div class="form-group"><label>Subject</label><input id="f-bulk-subject" value="General" /></div>
        <div class="form-group"><label style="visibility:hidden">Quick</label>
          <div style="display:flex;gap:8px;padding-top:4px">
            <button class="btn btn-ghost" type="button" onclick="setAllBulk('present')">All Present</button>
            <button class="btn btn-ghost" type="button" onclick="setAllBulk('absent')">All Absent</button>
          </div>
        </div>
      </div>
      <div class="bulk-list" id="bulk-list">
        ${studentData.filter(s => s.status === 'active').map(s => `
          <div class="bulk-row" data-id="${s.id}">
            <div class="student-cell"><div class="avatar">${esc(s.avatar)}</div><div><span class="td-main">${esc(s.name)}</span><br><span style="font-size:11px;color:var(--text3)">${esc(s.roll)} · ${esc(s.class)}</span></div></div>
            <div class="bulk-toggle" data-student="${s.id}">
              <button class="bulk-btn present active" onclick="setBulk(${s.id},'present')">P</button>
              <button class="bulk-btn absent" onclick="setBulk(${s.id},'absent')">A</button>
              <button class="bulk-btn late" onclick="setBulk(${s.id},'late')">L</button>
            </div>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitBulkAttendance('${date}')">Save Attendance</button>
      </div>`);
  }).catch(e => toast(e.message, 'error'));
}

function setBulk(studentId, status) {
  const wrap = document.querySelector(`.bulk-toggle[data-student="${studentId}"]`);
  wrap.querySelectorAll('.bulk-btn').forEach(b => b.classList.toggle('active', b.classList.contains(status)));
}

function setAllBulk(status) {
  document.querySelectorAll('.bulk-toggle').forEach(wrap => setBulk(+wrap.dataset.student, status));
}

async function submitBulkAttendance(date) {
  const subject = document.getElementById('f-bulk-subject').value.trim() || 'General';
  const records = [];
  document.querySelectorAll('.bulk-toggle').forEach(wrap => {
    const active = wrap.querySelector('.bulk-btn.active');
    records.push({ studentId: +wrap.dataset.student, status: active ? [...active.classList].find(c => ['present', 'absent', 'late'].includes(c)) : 'present' });
  });
  try {
    const r = await api('/api/attendance/bulk', { method: 'POST', body: { date, subject, records } });
    closeModal();
    toast(`Attendance saved — ${r.created} added, ${r.updated} updated`, 'success');
    attendance();
  } catch (e) { toast(e.message, 'error'); }
}

// ─── Marks ────────────────────────────────────────────────────────────────────

async function marks() {
  const [marksData, studentData] = await Promise.all([api('/api/marks'), api('/api/students')]);
  const studentMap = {};
  studentData.forEach(s => studentMap[s.id] = s);

  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Marks & Grades</h1><p>Academic performance records</p></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" onclick="downloadCsv('marks')">↓ CSV</button>
          <button class="btn btn-primary" onclick="addMarksModal()">+ Add Marks</button>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Subject</th><th>Exam</th><th>Marks</th><th>Grade</th><th>Performance</th></tr></thead>
            <tbody>
              ${marksData.map(m => {
                const s = studentMap[m.studentId];
                const pct = Math.round(m.marks / m.maxMarks * 100);
                const gradeColor = { 'A+': 'green', 'A': 'green', 'B+': 'blue', 'B': 'blue', 'C': 'amber', 'D': 'red' }[m.grade] || 'blue';
                return `<tr>
                  <td><div class="student-cell"><div class="avatar">${esc(s?.avatar || '??')}</div><span class="td-main">${esc(s?.name || 'Unknown')}</span></div></td>
                  <td>${esc(m.subject)}</td>
                  <td>${esc(m.exam)}</td>
                  <td class="td-main">${m.marks}/${m.maxMarks}</td>
                  <td><span class="badge badge-${gradeColor}">${esc(m.grade)}</span></td>
                  <td style="min-width:100px">
                    <div style="font-size:11px;color:var(--text3);margin-bottom:3px">${pct}%</div>
                    <div class="progress-bar"><div class="progress-fill ${pct >= 80 ? 'green' : pct >= 60 ? '' : 'red'}" style="width:${pct}%"></div></div>
                  </td>
                </tr>`;
              }).join('') || '<tr><td colspan="6" style="color:var(--text3)">No marks recorded</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function addMarksModal() {
  openModal(`
    <h2>Add Marks</h2>
    <div class="form-group"><label>Student</label>
      <select id="f-sid"><option value="">Select student…</option></select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Subject</label><input id="f-subject" placeholder="Mathematics" /></div>
      <div class="form-group"><label>Exam Type</label><input id="f-exam" placeholder="Mid Term" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Marks Obtained</label><input id="f-marks" type="number" min="0" placeholder="85" oninput="autoGrade()" /></div>
      <div class="form-group"><label>Maximum Marks</label><input id="f-max" type="number" min="1" value="100" oninput="autoGrade()" /></div>
    </div>
    <div class="form-group"><label>Grade (auto-calculated)</label><input id="f-grade" readonly value="—" /></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitMarks()">Add Marks</button>
    </div>`);
  api('/api/students').then(list => {
    const sel = document.getElementById('f-sid');
    sel.innerHTML = '<option value="">Select student…</option>' + list.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.roll)})</option>`).join('');
  }).catch(() => {});
}

function autoGrade() {
  const m = +document.getElementById('f-marks').value;
  const x = +document.getElementById('f-max').value;
  if (!m || !x) return;
  const pct = (m / x) * 100;
  document.getElementById('f-grade').value = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 45 ? 'C' : 'D';
}

async function submitMarks() {
  const payload = {
    studentId: +document.getElementById('f-sid').value,
    subject: document.getElementById('f-subject').value.trim(),
    exam: document.getElementById('f-exam').value.trim(),
    marks: +document.getElementById('f-marks').value,
    maxMarks: +document.getElementById('f-max').value,
  };
  if (!payload.studentId || !payload.subject) return toast('Student and subject required', 'error');
  try {
    await api('/api/marks', { method: 'POST', body: payload });
    closeModal(); toast('Marks added!', 'success'); marks();
  } catch (e) { toast(e.message, 'error'); }
}

// ─── Fees ─────────────────────────────────────────────────────────────────────

async function fees() {
  const [feesData, studentData] = await Promise.all([api('/api/fees'), api('/api/students')]);
  const studentMap = {};
  studentData.forEach(s => studentMap[s.id] = s);

  const totalDue = feesData.reduce((a, f) => a + f.due, 0);
  const totalPaid = feesData.reduce((a, f) => a + f.paid, 0);
  const overdue = feesData.filter(f => f.due > 0 && f.dueDate < todayStr());

  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Fees Management</h1><p>Track payments and dues</p></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" onclick="downloadCsv('fees')">↓ CSV</button>
          <button class="btn btn-primary" onclick="addFeeModal()">+ New Fee Record</button>
        </div>
      </div>
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
        <div class="stat-card"><span class="stat-icon">◉</span><div class="stat-value" style="color:var(--green)">${inr(totalPaid)}</div><div class="stat-label">Total Collected</div></div>
        <div class="stat-card"><span class="stat-icon">◎</span><div class="stat-value" style="color:var(--red)">${inr(totalDue)}</div><div class="stat-label">Total Pending</div></div>
        <div class="stat-card"><span class="stat-icon">◷</span><div class="stat-value" style="color:${overdue.length ? 'var(--amber)' : 'var(--green)'}">${overdue.length}</div><div class="stat-label">Overdue</div></div>
        <div class="stat-card"><span class="stat-icon">✓</span><div class="stat-value">${feesData.filter(f => f.status === 'paid').length}/${feesData.length}</div><div class="stat-label">Fully Paid</div></div>
      </div>
      ${totalDue > 0 ? `<div class="alert-banner"><span>⚠</span><div><strong>${inr(totalDue)} pending</strong> — send payment reminders to parents.</div><button class="btn btn-primary" onclick="navigate('reports')">Send Reminders →</button></div>` : ''}
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Term</th><th>Total</th><th>Paid</th><th>Due</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${feesData.map(f => {
                const s = studentMap[f.studentId];
                const badgeMap = { paid: 'green', partial: 'amber', unpaid: 'red' };
                const isOverdue = f.due > 0 && f.dueDate < todayStr();
                return `<tr>
                  <td><div class="student-cell"><div class="avatar">${esc(s?.avatar || '??')}</div><span class="td-main">${esc(s?.name || 'Unknown')}</span></div></td>
                  <td>${esc(f.term)}</td>
                  <td>${inr(f.amount)}</td>
                  <td style="color:var(--green)">${inr(f.paid)}</td>
                  <td style="color:${f.due > 0 ? 'var(--red)' : 'var(--text3)'}">${inr(f.due)}</td>
                  <td>${esc(f.dueDate)} ${isOverdue ? '<span class="badge badge-red">overdue</span>' : ''}</td>
                  <td><span class="badge badge-${badgeMap[f.status]}">${esc(f.status)}</span></td>
                  <td><div class="action-btns">
                    ${f.due > 0 ? `<button class="icon-btn" title="Record payment" onclick="payFeeModal(${f.id})">₹</button>` : ''}
                  </div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  window._feesData = feesData;
}

function payFeeModal(id) {
  const f = (window._feesData || []).find(x => x.id === id);
  if (!f) return;
  openModal(`
    <h2>Record Payment</h2>
    <p style="color:var(--text3);margin-bottom:12px">Pending: <strong style="color:var(--red)">${inr(f.due)}</strong> of ${inr(f.amount)} (${esc(f.term)})</p>
    <div class="form-group"><label>Amount Received</label><input id="f-pay" type="number" min="1" max="${f.due}" value="${f.due}" /></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitPayment(${id})">Record Payment</button>
    </div>`);
}

async function submitPayment(id) {
  try {
    await api(`/api/fees/${id}/pay`, { method: 'POST', body: { amount: +document.getElementById('f-pay').value } });
    closeModal(); toast('Payment recorded!', 'success'); fees();
  } catch (e) { toast(e.message, 'error'); }
}

function addFeeModal() {
  openModal(`
    <h2>New Fee Record</h2>
    <div class="form-group"><label>Student</label><select id="fee-sid"><option value="">Select student…</option></select></div>
    <div class="form-row">
      <div class="form-group"><label>Term</label><input id="fee-term" value="Term 2" /></div>
      <div class="form-group"><label>Amount (₹)</label><input id="fee-amount" type="number" min="1" placeholder="15000" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Already Paid (₹)</label><input id="fee-paid" type="number" min="0" value="0" /></div>
      <div class="form-group"><label>Due Date</label><input id="fee-due" type="date" value="${new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]}" /></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitFee()">Create</button>
    </div>`);
  api('/api/students').then(list => {
    document.getElementById('fee-sid').innerHTML = '<option value="">Select student…</option>' + list.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.roll)})</option>`).join('');
  }).catch(() => {});
}

async function submitFee() {
  const payload = {
    studentId: +document.getElementById('fee-sid').value,
    term: document.getElementById('fee-term').value.trim(),
    amount: +document.getElementById('fee-amount').value,
    paid: +document.getElementById('fee-paid').value,
    dueDate: document.getElementById('fee-due').value,
  };
  if (!payload.studentId || !payload.amount) return toast('Student and amount required', 'error');
  try {
    await api('/api/fees', { method: 'POST', body: payload });
    closeModal(); toast('Fee record created!', 'success'); fees();
  } catch (e) { toast(e.message, 'error'); }
}

// ─── Parent Alerts (the real-world core: notify parents) ─────────────────────

async function reports() {
  const date = window._alertDate || todayStr();
  window._alertDate = date;
  const [absentees, defaulters] = await Promise.all([
    api(`/api/reports/absentees?date=${date}`),
    api('/api/reports/fee-defaulters')
  ]);

  const rowsHtml = (rows, kind) => rows.map(r => `
    <div class="alert-row">
      <div class="student-cell">
        <div class="avatar">${esc((r.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase())}</div>
        <div>
          <span class="td-main">${esc(r.name)}</span>
          <br><span style="font-size:11px;color:var(--text3)">${esc(r.roll)} · ${esc(r.class)} · ${esc(r.guardian || 'Guardian')} · ${esc(r.phone || 'no phone')}</span>
        </div>
      </div>
      <div class="alert-msg">${esc(r.message)}</div>
      <div class="alert-actions">
        <button class="icon-btn" title="Copy message" onclick='copyText(${JSON.stringify(r.message)})'>⧉</button>
        ${r.whatsapp ? `<a class="icon-btn" title="Open WhatsApp" href="${esc(r.whatsapp)}" target="_blank" rel="noopener">✆</a>` : ''}
      </div>
    </div>`).join('') || '<p style="color:var(--text3);padding:16px">None — nothing to alert. ✓</p>';

  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Parent Alerts</h1><p>Absentee notifications & fee reminders — copy or send directly on WhatsApp</p></div>
        <input type="date" class="search-inline" value="${date}" onchange="window._alertDate=this.value;reports()" style="width:170px" />
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="card-header">
            <h3>✗ Absentees — ${date}</h3>
            <span class="badge badge-${absentees.count ? 'red' : 'green'}">${absentees.count}</span>
          </div>
          <div class="card-body alert-list">${rowsHtml(absentees.rows, 'absent')}</div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>◉ Fee Reminders</h3>
            <span class="badge badge-${defaulters.count ? 'amber' : 'green'}">${defaulters.count} · ${inr(defaulters.totalDue)} due</span>
          </div>
          <div class="card-body alert-list">${rowsHtml(defaulters.rows, 'fee')}</div>
        </div>
      </div>
    </div>`;
}

// ─── Timetable ────────────────────────────────────────────────────────────────

async function timetable() {
  const data = await api('/api/timetable');

  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Timetable</h1><p>Weekly class schedule</p></div>
      </div>
      <div class="card">
        <div class="card-body" style="overflow-x:auto">
          <div class="timetable-grid">
            <div class="tt-header">Day</div>
            ${data[0].slots.map(s => `<div class="tt-header">${esc(s.time)}</div>`).join('')}
            ${data.map(row => `
              <div class="tt-day">${esc(row.day)}</div>
              ${row.slots.map(slot => `
                <div class="tt-cell">
                  <div class="tt-time">${esc(slot.time)}</div>
                  <div class="tt-subject">${esc(slot.subject)}</div>
                  <div class="tt-teacher">${esc(slot.teacher)}</div>
                </div>`).join('')}
            `).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

// ─── Notices ──────────────────────────────────────────────────────────────────

async function notices() {
  const data = await api('/api/notices');

  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Notice Board</h1><p>${data.length} active notices</p></div>
        <button class="btn btn-primary" onclick="addNoticeModal()">+ Post Notice</button>
      </div>
      <div class="notices-list">
        ${data.map(n => `
          <div class="notice-card">
            <div class="notice-dot ${esc(n.priority)}"></div>
            <div style="flex:1">
              <div class="notice-title">${esc(n.title)}</div>
              <div class="notice-text">${esc(n.content)}</div>
              <div class="notice-meta">
                <span>📅 ${esc(n.date)}</span>
                <span class="badge badge-${n.type === 'academic' ? 'blue' : n.type === 'holiday' ? 'green' : 'amber'}">${esc(n.type)}</span>
                <span class="badge badge-${n.priority === 'high' ? 'red' : 'amber'}">${esc(n.priority)} priority</span>
              </div>
            </div>
            <div class="notice-actions">
              <button class="icon-btn del" onclick="deleteNotice(${n.id})">✕</button>
            </div>
          </div>`).join('') || '<p style="color:var(--text3)">No notices yet.</p>'}
      </div>
    </div>`;
}

function addNoticeModal() {
  openModal(`
    <h2>Post a Notice</h2>
    <div class="form-group"><label>Title</label><input id="f-title" placeholder="Notice title" /></div>
    <div class="form-group"><label>Content</label><textarea id="f-content" placeholder="Describe the notice…"></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Type</label>
        <select id="f-type"><option>academic</option><option>event</option><option>holiday</option><option>general</option></select>
      </div>
      <div class="form-group"><label>Priority</label>
        <select id="f-priority"><option>high</option><option>medium</option><option>low</option></select>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitNotice()">Post Notice</button>
    </div>`);
}

async function submitNotice() {
  const payload = {
    title: document.getElementById('f-title').value.trim(),
    content: document.getElementById('f-content').value.trim(),
    type: document.getElementById('f-type').value,
    priority: document.getElementById('f-priority').value,
  };
  if (!payload.title) return toast('Title is required', 'error');
  try {
    await api('/api/notices', { method: 'POST', body: payload });
    closeModal(); toast('Notice posted!', 'success'); notices();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteNotice(id) {
  if (!confirm('Delete this notice?')) return;
  try {
    await api('/api/notices/' + id, { method: 'DELETE' });
    toast('Notice deleted', 'success'); notices();
  } catch (e) { toast(e.message, 'error'); }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

async function chat() {
  const data = await api('/api/messages');

  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Chat Support</h1><p>Message the school admin</p></div>
      </div>
      <div class="chat-wrap">
        <div class="chat-messages" id="chat-messages">
          ${data.map(m => chatBubble(m)).join('')}
        </div>
        <div class="chat-input-bar">
          <input id="chat-input" placeholder="Type your message…" onkeydown="if(event.key==='Enter')sendMessage()" />
          <button class="btn btn-primary" onclick="sendMessage()">Send ➤</button>
        </div>
      </div>
    </div>`;

  scrollChat();
}

function chatBubble(m) {
  return `<div class="chat-msg ${esc(m.type || 'support')}">
    <div class="avatar" style="width:28px;height:28px;font-size:10px;flex-shrink:0">${m.type === 'user' ? 'ME' : 'AD'}</div>
    <div>
      <div class="chat-bubble">${esc(m.text)}</div>
      <span class="chat-time">${esc(m.time)}</span>
    </div>
  </div>`;
}

function scrollChat() {
  const el = document.getElementById('chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    await api('/api/messages', { method: 'POST', body: { from: 'Student', text, type: 'user' } });
    const data = await api('/api/messages');
    document.getElementById('chat-messages').innerHTML = data.map(m => chatBubble(m)).join('');
    scrollChat();
  } catch (e) { toast(e.message, 'error'); }
}

// ─── Settings (password, backup, restore) ─────────────────────────────────────

async function settings() {
  document.getElementById('content').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Settings</h1><p>Security & data management</p></div>
      </div>
      <div class="dash-grid">
        <div class="card">
          <div class="card-header"><h3>Change Password</h3></div>
          <div class="card-body">
            <div class="form-group"><label>Current Password</label><input id="pw-current" type="password" autocomplete="current-password" /></div>
            <div class="form-group"><label>New Password (min 8 chars)</label><input id="pw-new" type="password" autocomplete="new-password" /></div>
            <div class="form-group"><label>Confirm New Password</label><input id="pw-confirm" type="password" autocomplete="new-password" /></div>
            <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Backup & Restore</h3></div>
          <div class="card-body">
            <p style="color:var(--text3);margin-bottom:14px">All data is stored in <code>data/db.json</code>. Download a backup before major changes; restore to roll back.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-primary" onclick="downloadBackup()">↓ Download Backup</button>
              <label class="btn btn-ghost" style="cursor:pointer">
                ↑ Restore from File
                <input type="file" accept="application/json" hidden onchange="restoreBackup(this)" />
              </label>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Data Exports (CSV)</h3></div>
          <div class="card-body">
            <p style="color:var(--text3);margin-bottom:14px">Spreadsheet-ready exports for school records and audits.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-ghost" onclick="downloadCsv('students')">Students</button>
              <button class="btn btn-ghost" onclick="downloadCsv('attendance')">Attendance</button>
              <button class="btn btn-ghost" onclick="downloadCsv('marks')">Marks</button>
              <button class="btn btn-ghost" onclick="downloadCsv('fees')">Fees</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Session</h3></div>
          <div class="card-body">
            <p style="color:var(--text3);margin-bottom:14px">Signed in as <strong id="settings-user">—</strong>. Sessions expire after 8 hours.</p>
            <button class="btn btn-danger" onclick="logout()">Sign Out</button>
          </div>
        </div>
      </div>
    </div>`;
  try {
    const me = await api('/api/auth/me');
    document.getElementById('settings-user').textContent = `${me.username} (${me.role})`;
  } catch {}
}

async function changePassword() {
  const currentPassword = document.getElementById('pw-current').value;
  const newPassword = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  if (newPassword !== confirm) return toast('New passwords do not match', 'error');
  try {
    await api('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    toast('Password updated!', 'success');
    document.getElementById('pw-current').value = document.getElementById('pw-new').value = document.getElementById('pw-confirm').value = '';
  } catch (e) { toast(e.message, 'error'); }
}

async function downloadBackup() {
  try {
    const res = await fetch(API + '/api/backup', { headers: { Authorization: 'Bearer ' + getToken() } });
    if (!res.ok) throw new Error('Backup failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `edunest-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function restoreBackup(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  if (!confirm('Restore will REPLACE all current data with this backup. Continue?')) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const r = await api('/api/restore', { method: 'POST', body: data });
    toast(`Restored — ${r.students} students, ${r.fees} fee records`, 'success');
    navigate('dashboard');
  } catch (e) { toast('Restore failed: ' + e.message, 'error'); }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

boot();
