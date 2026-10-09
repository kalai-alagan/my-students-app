const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { load, save, saveNow, replaceAll, nextId, today, offsetDate, DB_FILE } = require('./store');
const { ensureAdmin, hashPassword, verifyPassword, issueToken, requireAuth } = require('./auth');

ensureAdmin();
const db = load();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// ─── Auth ────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return bad(res, 'Username and password required');
  const user = db.users.find(u => u.username === String(username).trim().toLowerCase());
  if (!user || !user.hash || !verifyPassword(String(password), user.salt, user.hash)) {
    return bad(res, 'Invalid username or password', 401);
  }
  res.json({ token: issueToken(user), user: { username: user.username, role: user.role } });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.user));

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return bad(res, 'Both passwords required');
  if (String(newPassword).length < 8) return bad(res, 'New password must be at least 8 characters');
  const user = db.users.find(u => u.username === req.user.username);
  if (!verifyPassword(String(currentPassword), user.salt, user.hash)) return bad(res, 'Current password is incorrect', 401);
  const { salt, hash } = hashPassword(String(newPassword));
  user.salt = salt;
  user.hash = hash;
  save();
  res.json({ success: true });
});

// Everything below requires auth
app.use('/api', requireAuth);

// ─── Dashboard stats (real dates, not hardcoded) ─────────────────────────────

app.get('/api/stats', (req, res) => {
  const t = today();
  const active = db.students.filter(s => s.status === 'active');
  const presentToday = db.attendance.filter(a => a.date === t && a.status === 'present').length;
  const absentToday = db.attendance.filter(a => a.date === t && a.status === 'absent').length;
  const markedToday = db.attendance.filter(a => a.date === t).length;
  const defaulters = db.fees.filter(f => f.due > 0);
  res.json({
    totalStudents: db.students.length,
    activeStudents: active.length,
    todayPresent: presentToday,
    todayAbsent: absentToday,
    markedToday,
    attendanceMarked: markedToday > 0,
    feePaid: db.fees.filter(f => f.status === 'paid').length,
    feeUnpaid: db.fees.filter(f => f.status !== 'paid').length,
    totalPending: defaulters.reduce((a, f) => a + f.due, 0),
    totalNotices: db.notices.length,
    overdueFees: defaulters.filter(f => f.dueDate < t).length,
  });
});

// ─── Students ────────────────────────────────────────────────────────────────

const makeAvatar = (name) => String(name || '?').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);

app.get('/api/students', (req, res) => res.json(db.students));

app.get('/api/students/:id', (req, res) => {
  const s = db.students.find(x => x.id === +req.params.id);
  s ? res.json(s) : bad(res, 'Not found', 404);
});

app.post('/api/students', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.roll) return bad(res, 'Name and roll number are required');
  if (db.students.some(s => s.roll === String(b.roll).trim())) return bad(res, 'Roll number already exists');
  const student = {
    id: nextId(db.students),
    name: String(b.name).trim(),
    roll: String(b.roll).trim(),
    class: b.class || '10-A',
    email: (b.email || '').trim(),
    phone: (b.phone || '').trim(),
    guardian: (b.guardian || '').trim(),
    status: b.status || 'active',
    avatar: makeAvatar(b.name),
  };
  db.students.push(student);
  save();
  res.status(201).json(student);
});

app.put('/api/students/:id', (req, res) => {
  const s = db.students.find(x => x.id === +req.params.id);
  if (!s) return bad(res, 'Not found', 404);
  const b = req.body || {};
  if (b.roll && db.students.some(x => x.roll === String(b.roll).trim() && x.id !== s.id)) {
    return bad(res, 'Roll number already exists');
  }
  Object.assign(s, {
    name: b.name !== undefined ? String(b.name).trim() : s.name,
    roll: b.roll !== undefined ? String(b.roll).trim() : s.roll,
    class: b.class ?? s.class,
    email: b.email ?? s.email,
    phone: b.phone ?? s.phone,
    guardian: b.guardian ?? s.guardian,
    status: b.status ?? s.status,
  });
  if (b.name) s.avatar = makeAvatar(b.name);
  save();
  res.json(s);
});

app.delete('/api/students/:id', (req, res) => {
  const id = +req.params.id;
  const before = db.students.length;
  db.students = db.students.filter(s => s.id !== id);
  if (db.students.length === before) return bad(res, 'Not found', 404);
  save();
  res.json({ success: true });
});

// Student profile report card: attendance %, fee summary, average marks
app.get('/api/students/:id/profile', (req, res) => {
  const id = +req.params.id;
  const s = db.students.find(x => x.id === id);
  if (!s) return bad(res, 'Not found', 404);
  const att = db.attendance.filter(a => a.studentId === id);
  const present = att.filter(a => a.status === 'present').length;
  const absent = att.filter(a => a.status === 'absent').length;
  const stuMarks = db.marks.filter(m => m.studentId === id);
  const avg = stuMarks.length
    ? Math.round(stuMarks.reduce((a, m) => a + (m.marks / m.maxMarks) * 100, 0) / stuMarks.length)
    : null;
  const feeRows = db.fees.filter(f => f.studentId === id);
  res.json({
    student: s,
    attendance: { present, absent, late: att.filter(a => a.status === 'late').length, total: att.length, percent: att.length ? Math.round((present / att.length) * 100) : null },
    marks: { records: stuMarks, average: avg },
    fees: { rows: feeRows, due: feeRows.reduce((a, f) => a + f.due, 0), paid: feeRows.reduce((a, f) => a + f.paid, 0) },
  });
});

// ─── Attendance (incl. bulk marking — the daily time-saver) ──────────────────

app.get('/api/attendance', (req, res) => {
  let rows = db.attendance;
  if (req.query.date) rows = rows.filter(a => a.date === req.query.date);
  res.json(rows);
});

app.post('/api/attendance', (req, res) => {
  const b = req.body || {};
  if (!b.studentId || !b.date || !b.status) return bad(res, 'studentId, date and status required');
  if (!db.students.some(s => s.id === +b.studentId)) return bad(res, 'Unknown student');
  const record = { id: nextId(db.attendance), studentId: +b.studentId, date: b.date, subject: b.subject || 'General', status: b.status };
  db.attendance.push(record);
  save();
  res.status(201).json(record);
});

// Bulk: mark a whole class for a date in one request (idempotent per student+date)
app.post('/api/attendance/bulk', (req, res) => {
  const { date, subject, records } = req.body || {};
  if (!date || !Array.isArray(records) || !records.length) return bad(res, 'date and records[] required');
  let created = 0, updated = 0;
  for (const r of records) {
    if (!r.studentId || !r.status) continue;
    const existing = db.attendance.find(a => a.studentId === +r.studentId && a.date === date);
    if (existing) {
      existing.status = r.status;
      if (subject) existing.subject = subject;
      updated++;
    } else {
      db.attendance.push({ id: nextId(db.attendance), studentId: +r.studentId, date, subject: subject || 'General', status: r.status });
      created++;
    }
  }
  save();
  res.status(201).json({ created, updated });
});

// ─── Marks ───────────────────────────────────────────────────────────────────

const gradeFor = (pct) => (pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 45 ? 'C' : 'D');

app.get('/api/marks', (req, res) => res.json(db.marks));
app.get('/api/marks/student/:id', (req, res) => res.json(db.marks.filter(m => m.studentId === +req.params.id)));

app.post('/api/marks', (req, res) => {
  const b = req.body || {};
  if (!b.studentId || b.marks == null || !b.maxMarks) return bad(res, 'studentId, marks and maxMarks required');
  if (+b.marks > +b.maxMarks) return bad(res, 'Marks cannot exceed maxMarks');
  const pct = (b.marks / b.maxMarks) * 100;
  const record = {
    id: nextId(db.marks), studentId: +b.studentId,
    subject: b.subject || 'General', exam: b.exam || 'Test',
    marks: +b.marks, maxMarks: +b.maxMarks,
    grade: b.grade || gradeFor(pct),
  };
  db.marks.push(record);
  save();
  res.status(201).json(record);
});

// ─── Fees (with payment recording — solves "who paid what") ──────────────────

const feeStatus = (f) => (f.paid >= f.amount ? 'paid' : f.paid > 0 ? 'partial' : 'unpaid');

app.get('/api/fees', (req, res) => res.json(db.fees));

app.post('/api/fees', (req, res) => {
  const b = req.body || {};
  if (!b.studentId || !b.amount) return bad(res, 'studentId and amount required');
  const record = {
    id: nextId(db.fees), studentId: +b.studentId, amount: +b.amount, paid: +(b.paid || 0),
    due: +b.amount - +(b.paid || 0), term: b.term || 'Term 1',
    dueDate: b.dueDate || offsetDate(30), status: 'unpaid',
  };
  record.status = feeStatus(record);
  db.fees.push(record);
  save();
  res.status(201).json(record);
});

// Record a payment against a fee row
app.post('/api/fees/:id/pay', (req, res) => {
  const f = db.fees.find(x => x.id === +req.params.id);
  if (!f) return bad(res, 'Not found', 404);
  const amount = +(req.body || {}).amount;
  if (!amount || amount <= 0) return bad(res, 'Positive payment amount required');
  if (f.paid + amount > f.amount) return bad(res, `Payment exceeds pending dues (₹${f.due})`);
  f.paid += amount;
  f.due = f.amount - f.paid;
  f.status = feeStatus(f);
  save();
  res.json(f);
});

app.put('/api/fees/:id', (req, res) => {
  const f = db.fees.find(x => x.id === +req.params.id);
  if (!f) return bad(res, 'Not found', 404);
  Object.assign(f, req.body || {});
  f.due = f.amount - f.paid;
  f.status = feeStatus(f);
  save();
  res.json(f);
});

// ─── Notices ─────────────────────────────────────────────────────────────────

app.get('/api/notices', (req, res) => res.json(db.notices));

app.post('/api/notices', (req, res) => {
  const b = req.body || {};
  if (!b.title) return bad(res, 'Title required');
  const record = { id: nextId(db.notices), date: today(), type: 'general', priority: 'medium', content: '', ...b };
  db.notices.push(record);
  save();
  res.status(201).json(record);
});

app.delete('/api/notices/:id', (req, res) => {
  const before = db.notices.length;
  db.notices = db.notices.filter(n => n.id !== +req.params.id);
  if (db.notices.length === before) return bad(res, 'Not found', 404);
  save();
  res.json({ success: true });
});

// ─── Timetable & Chat ────────────────────────────────────────────────────────

app.get('/api/timetable', (req, res) => res.json(db.timetable));

app.get('/api/messages', (req, res) => res.json(db.messages));

app.post('/api/messages', (req, res) => {
  const b = req.body || {};
  if (!b.text) return bad(res, 'Text required');
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const msg = { id: nextId(db.messages), from: b.from || 'Student', text: String(b.text).slice(0, 2000), time, type: b.type || 'user' };
  db.messages.push(msg);
  const reply = { id: nextId(db.messages), from: 'Admin', text: 'Thank you for your message! We will get back to you shortly.', time, type: 'support' };
  db.messages.push(reply);
  save();
  res.status(201).json(msg);
});

// ─── Reports: absentee alerts + fee defaulters (the core real-world need) ────

function parentMessage(student, kind, extra) {
  if (kind === 'absent') {
    return `Dear Parent/Guardian of ${student.name} (${student.roll}), your child was marked ABSENT on ${extra.date}${extra.subject ? ` (${extra.subject})` : ''} at school. Please confirm their safety. — EduNest School Admin`;
  }
  return `Dear Parent/Guardian of ${student.name} (${student.roll}), a fee of ₹${extra.due.toLocaleString('en-IN')} is pending (due ${extra.dueDate}). Kindly clear it at the earliest. — EduNest School Admin`;
}

// Students absent on a given date → ready-to-send parent alerts
app.get('/api/reports/absentees', (req, res) => {
  const date = req.query.date || today();
  const rows = db.attendance.filter(a => a.date === date && a.status === 'absent').map(a => {
    const s = db.students.find(x => x.id === a.studentId);
    if (!s) return null;
    return {
      studentId: s.id, name: s.name, roll: s.roll, class: s.class,
      phone: s.phone, guardian: s.guardian, subject: a.subject, date,
      message: parentMessage(s, 'absent', { date, subject: a.subject }),
      whatsapp: s.phone ? `https://wa.me/91${s.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(parentMessage(s, 'absent', { date, subject: a.subject }))}` : null,
    };
  }).filter(Boolean);
  res.json({ date, count: rows.length, rows });
});

// Fee defaulters → ready-to-send payment reminders
app.get('/api/reports/fee-defaulters', (req, res) => {
  const t = today();
  const rows = db.fees.filter(f => f.due > 0).map(f => {
    const s = db.students.find(x => x.id === f.studentId);
    if (!s) return null;
    const msg = parentMessage(s, 'fee', { due: f.due, dueDate: f.dueDate });
    return {
      feeId: f.id, studentId: s.id, name: s.name, roll: s.roll, class: s.class,
      phone: s.phone, guardian: s.guardian, amount: f.amount, paid: f.paid, due: f.due,
      term: f.term, dueDate: f.dueDate, overdue: f.dueDate < t,
      message: msg,
      whatsapp: s.phone ? `https://wa.me/91${s.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(msg)}` : null,
    };
  }).filter(Boolean);
  const totalDue = rows.reduce((a, r) => a + r.due, 0);
  res.json({ count: rows.length, totalDue, overdue: rows.filter(r => r.overdue).length, rows });
});

// ─── CSV export (schools run on spreadsheets) ────────────────────────────────

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const sendCsv = (res, name, headers, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send([headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\r\n'));
};

app.get('/api/export/:entity.csv', (req, res) => {
  const { entity } = req.params;
  const sMap = Object.fromEntries(db.students.map(s => [s.id, s]));
  if (entity === 'students') {
    return sendCsv(res, 'students.csv', ['ID', 'Name', 'Roll', 'Class', 'Email', 'Phone', 'Guardian', 'Status'],
      db.students.map(s => [s.id, s.name, s.roll, s.class, s.email, s.phone, s.guardian, s.status]));
  }
  if (entity === 'attendance') {
    return sendCsv(res, 'attendance.csv', ['Date', 'Student', 'Roll', 'Class', 'Subject', 'Status'],
      db.attendance.map(a => [a.date, sMap[a.studentId]?.name || a.studentId, sMap[a.studentId]?.roll || '', sMap[a.studentId]?.class || '', a.subject, a.status]));
  }
  if (entity === 'marks') {
    return sendCsv(res, 'marks.csv', ['Student', 'Roll', 'Subject', 'Exam', 'Marks', 'Max', 'Grade'],
      db.marks.map(m => [sMap[m.studentId]?.name || m.studentId, sMap[m.studentId]?.roll || '', m.subject, m.exam, m.marks, m.maxMarks, m.grade]));
  }
  if (entity === 'fees') {
    return sendCsv(res, 'fees.csv', ['Student', 'Roll', 'Term', 'Amount', 'Paid', 'Due', 'Due Date', 'Status'],
      db.fees.map(f => [sMap[f.studentId]?.name || f.studentId, sMap[f.studentId]?.roll || '', f.term, f.amount, f.paid, f.due, f.dueDate, f.status]));
  }
  bad(res, 'Unknown export. Use: students, attendance, marks, fees', 404);
});

// ─── Backup / restore (protects against data loss) ───────────────────────────

app.get('/api/backup', (req, res) => {
  saveNow();
  res.setHeader('Content-Disposition', `attachment; filename="edunest-backup-${today()}.json"`);
  res.sendFile(DB_FILE);
});

app.post('/api/restore', (req, res) => {
  try {
    replaceAll(req.body || {});
    res.json({ success: true, students: db.students.length, fees: db.fees.length });
  } catch (e) {
    bad(res, e.message);
  }
});

// ─── SPA fallback (after API) ────────────────────────────────────────────────

app.use('/api', (req, res) => bad(res, 'Not found', 404));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ EduNest running at http://localhost:${PORT}`));
