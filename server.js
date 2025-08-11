// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// ====== الإعدادات ======
let EXAM_CODE  = process.env.EXAM_CODE  || '1234';
const ADMIN_CODE = process.env.ADMIN_CODE || '9999';

// ====== الحالة في الذاكرة ======
let callsMen = [];     // [{student, committee, ticket, at}]
let callsWomen = [];   // [{...}]
let noteText = '';
let absents  = { MEN: [], WOMEN: [] };

const MAX_LIST = 12;

// ====== تقديم ملفات الواجهة ======
app.use(express.static(path.join(__dirname, 'public')));

// صفحة افتراضية لعرض الشاشة
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

// ====== أدوات مساعدة ======
function mkTicket(gender, student) {
  const p = (gender === 'MEN') ? 'A' : 'C';
  return p + String(student).padStart(3, '0');
}
function trimList(arr) {
  if (arr.length > MAX_LIST) arr.splice(0, arr.length - MAX_LIST);
}

// ====== Socket.IO ======
io.on('connection', (socket) => {
  // أرسل الحالة الحالية للعميل الجديد
  socket.emit('display:init', {
    men: callsMen,
    women: callsWomen,
    note: noteText,
    abs: absents,
    examCode: EXAM_CODE
  });

  // ===== النداء =====
  socket.on('exam:call', ({ gender, student, committee, code }) => {
    if (code !== EXAM_CODE) return;
    const g = (gender === 'WOMEN') ? 'WOMEN' : 'MEN';
    const s = parseInt(student, 10);
    const c = parseInt(committee, 10);
    if (!Number.isFinite(s) || !Number.isFinite(c)) return;

    const ticket = mkTicket(g, s);
    const item = { student: s, committee: c, ticket, at: Date.now() };

    if (g === 'MEN') {
      callsMen.push(item); trimList(callsMen);
    } else {
      callsWomen.push(item); trimList(callsWomen);
    }
    io.emit('display:call', { gender: g, ...item });
  });

  // مسح المركز (اختياري)
  socket.on('exam:clear', ({ code }) => {
    if (code !== EXAM_CODE) return;
    io.emit('display:clear');
  });

  // ===== الملاحظات =====
  socket.on('exam:note', ({ text, code }) => {
    if (code !== EXAM_CODE) return;
    noteText = (text || '').trim();
    io.emit('note:update', noteText);
  });

  // ===== الغياب =====
  socket.on('exam:abs:add', ({ gender, number, code }) => {
    if (code !== EXAM_CODE) return;
    const g = (gender === 'WOMEN') ? 'WOMEN' : 'MEN';
    const n = parseInt(number, 10);
    if (!Number.isFinite(n)) return;
    if (!absents[g].includes(n)) {
      absents[g].push(n);
      absents[g].sort((a,b)=>a-b);
    }
    io.emit('abs:update', absents);
  });

  socket.on('exam:abs:remove', ({ gender, number, code }) => {
    if (code !== EXAM_CODE) return;
    const g = (gender === 'WOMEN') ? 'WOMEN' : 'MEN';
    const n = parseInt(number, 10);
    absents[g] = absents[g].filter(x => x !== n);
    io.emit('abs:update', absents);
  });

  // ===== صلاحيات المدير =====
  socket.on('admin:examcode', ({ admin, value }) => {
    if (admin !== ADMIN_CODE) return;
    EXAM_CODE = String(value || '').trim() || EXAM_CODE;
    io.emit('admin:examcode', EXAM_CODE);
  });

  socket.on('admin:clearAll', ({ admin }) => {
    if (admin !== ADMIN_CODE) return;
    callsMen = []; callsWomen = [];
    io.emit('display:init', {
      men: callsMen, women: callsWomen,
      note: noteText, abs: absents, examCode: EXAM_CODE
    });
  });

  socket.on('admin:resetNote', ({ admin }) => {
    if (admin !== ADMIN_CODE) return;
    noteText = '';
    io.emit('note:update', noteText);
  });

  socket.on('admin:resetAbs', ({ admin }) => {
    if (admin !== ADMIN_CODE) return;
    absents = { MEN: [], WOMEN: [] };
    io.emit('abs:update', absents);
  });
});

// ====== التشغيل ======
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log('Queue server running on http://localhost:' + PORT);
  console.log('Exam code (EXAM_CODE):', EXAM_CODE);
});
