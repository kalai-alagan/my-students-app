/* JSON file persistence — fixes data-loss on server restart */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const today = () => new Date().toISOString().split('T')[0];
const nextId = (arr) => arr.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;

function seed() {
  const t = today();
  return {
    users: [{ id: 1, username: 'admin', salt: null, hash: null, role: 'Administrator' }],
    students: [
      { id: 1, name: 'Aanya Sharma', roll: 'CS101', class: '10-A', email: 'aanya@school.com', phone: '9876543210', guardian: 'Rajesh Sharma', avatar: 'AS', status: 'active' },
      { id: 2, name: 'Rohan Mehta', roll: 'CS102', class: '10-A', email: 'rohan@school.com', phone: '9876543211', guardian: 'Suresh Mehta', avatar: 'RM', status: 'active' },
      { id: 3, name: 'Priya Nair', roll: 'CS103', class: '10-B', email: 'priya@school.com', phone: '9876543212', guardian: 'Anil Nair', avatar: 'PN', status: 'active' },
      { id: 4, name: 'Dev Patel', roll: 'CS104', class: '10-B', email: 'dev@school.com', phone: '9876543213', guardian: 'Kiran Patel', avatar: 'DP', status: 'inactive' },
      { id: 5, name: 'Sneha Reddy', roll: 'CS105', class: '10-A', email: 'sneha@school.com', phone: '9876543214', guardian: 'Mohan Reddy', avatar: 'SR', status: 'active' },
      { id: 6, name: 'Arjun Kumar', roll: 'CS106', class: '10-C', email: 'arjun@school.com', phone: '98765432121', guardian: 'Vijay Kumar', avatar: 'AK', status: 'active' },
    ],
    attendance: [
      { id: 1, studentId: 1, date: t, status: 'present', subject: 'Mathematics' },
      { id: 2, studentId: 2, date: t, status: 'absent', subject: 'Mathematics' },
      { id: 3, studentId: 3, date: t, status: 'present', subject: 'Mathematics' },
      { id: 4, studentId: 4, date: t, status: 'late', subject: 'Mathematics' },
      { id: 5, studentId: 5, date: t, status: 'present', subject: 'Mathematics' },
      { id: 6, studentId: 6, date: t, status: 'present', subject: 'Mathematics' },
    ],
    marks: [
      { id: 1, studentId: 1, subject: 'Mathematics', exam: 'Mid Term', marks: 88, maxMarks: 100, grade: 'A' },
      { id: 2, studentId: 1, subject: 'Science', exam: 'Mid Term', marks: 92, maxMarks: 100, grade: 'A+' },
      { id: 3, studentId: 2, subject: 'Mathematics', exam: 'Mid Term', marks: 74, maxMarks: 100, grade: 'B' },
      { id: 4, studentId: 2, subject: 'Science', exam: 'Mid Term', marks: 81, maxMarks: 100, grade: 'A' },
      { id: 5, studentId: 3, subject: 'Mathematics', exam: 'Mid Term', marks: 95, maxMarks: 100, grade: 'A+' },
      { id: 6, studentId: 3, subject: 'Science', exam: 'Mid Term', marks: 78, maxMarks: 100, grade: 'B+' },
    ],
    fees: [
      { id: 1, studentId: 1, amount: 15000, paid: 15000, due: 0, term: 'Term 1', status: 'paid', dueDate: offsetDate(-30) },
      { id: 2, studentId: 2, amount: 15000, paid: 7500, due: 7500, term: 'Term 1', status: 'partial', dueDate: offsetDate(2) },
      { id: 3, studentId: 3, amount: 15000, paid: 0, due: 15000, term: 'Term 1', status: 'unpaid', dueDate: offsetDate(-15) },
      { id: 4, studentId: 4, amount: 15000, paid: 15000, due: 0, term: 'Term 1', status: 'paid', dueDate: offsetDate(-30) },
      { id: 5, studentId: 5, amount: 15000, paid: 15000, due: 0, term: 'Term 1', status: 'paid', dueDate: offsetDate(-30) },
      { id: 6, studentId: 6, amount: 15000, paid: 5000, due: 10000, term: 'Term 1', status: 'partial', dueDate: offsetDate(-5) },
    ],
    notices: [
      { id: 1, title: 'Annual Sports Day', content: 'Annual Sports Day will be held on May 15th. All students must participate.', date: offsetDate(-3), type: 'event', priority: 'high' },
      { id: 2, title: 'Exam Schedule Released', content: 'Final exam schedule for Term 1 has been released. Check the timetable section.', date: offsetDate(-4), type: 'academic', priority: 'high' },
      { id: 3, title: 'Holiday Notice', content: 'School will remain closed on May 1st for Labour Day.', date: offsetDate(-5), type: 'holiday', priority: 'medium' },
      { id: 4, title: 'Parent-Teacher Meeting', content: 'PTM is scheduled for May 5th from 9 AM to 1 PM.', date: offsetDate(-6), type: 'event', priority: 'medium' },
    ],
    timetable: [
      { day: 'Monday', slots: [{ time: '8:00-9:00', subject: 'Mathematics', teacher: 'Mr. Sharma' }, { time: '9:00-10:00', subject: 'Science', teacher: 'Ms. Nair' }, { time: '10:15-11:15', subject: 'English', teacher: 'Mr. Roy' }, { time: '11:15-12:15', subject: 'History', teacher: 'Ms. Das' }] },
      { day: 'Tuesday', slots: [{ time: '8:00-9:00', subject: 'Science', teacher: 'Ms. Nair' }, { time: '9:00-10:00', subject: 'Mathematics', teacher: 'Mr. Sharma' }, { time: '10:15-11:15', subject: 'Computer', teacher: 'Mr. Patel' }, { time: '11:15-12:15', subject: 'Hindi', teacher: 'Ms. Gupta' }] },
      { day: 'Wednesday', slots: [{ time: '8:00-9:00', subject: 'English', teacher: 'Mr. Roy' }, { time: '9:00-10:00', subject: 'Computer', teacher: 'Mr. Patel' }, { time: '10:15-11:15', subject: 'Mathematics', teacher: 'Mr. Sharma' }, { time: '11:15-12:15', subject: 'Geography', teacher: 'Mr. Kumar' }] },
      { day: 'Thursday', slots: [{ time: '8:00-9:00', subject: 'Hindi', teacher: 'Ms. Gupta' }, { time: '9:00-10:00', subject: 'History', teacher: 'Ms. Das' }, { time: '10:15-11:15', subject: 'Science', teacher: 'Ms. Nair' }, { time: '11:15-12:15', subject: 'Mathematics', teacher: 'Mr. Sharma' }] },
      { day: 'Friday', slots: [{ time: '8:00-9:00', subject: 'Geography', teacher: 'Mr. Kumar' }, { time: '9:00-10:00', subject: 'English', teacher: 'Mr. Roy' }, { time: '10:15-11:15', subject: 'Hindi', teacher: 'Ms. Gupta' }, { time: '11:15-12:15', subject: 'Computer', teacher: 'Mr. Patel' }] },
    ],
    messages: [
      { id: 1, from: 'Admin', text: 'Welcome to the Student Portal! How can I help you?', time: '09:00', type: 'support' },
    ],
    meta: { nextUserId: 2 },
  };
}

function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

let db = null;
let saveTimer = null;

function load() {
  if (db) return db;
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return db;
    }
  } catch (e) {
    console.error('⚠ Could not read db.json, reseeding:', e.message);
  }
  db = seed();
  saveNow();
  return db;
}

function saveNow() {
  if (!db) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // atomic — never leaves a half-written file
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

function replaceAll(newDb) {
  const required = ['students', 'attendance', 'marks', 'fees', 'notices', 'timetable', 'messages', 'users'];
  for (const k of required) if (!Array.isArray(newDb[k])) throw new Error(`Invalid backup: missing "${k}" array`);
  const fresh = { ...seed(), ...newDb };
  if (db) {
    // Mutate in place — callers (server.js) hold a reference to this object
    for (const k of Object.keys(db)) delete db[k];
    Object.assign(db, fresh);
  } else {
    db = fresh;
  }
  saveNow();
  return db;
}

module.exports = { load, save, saveNow, replaceAll, nextId, today, offsetDate, DB_FILE };
