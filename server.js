// server.js
'use strict';

/**
 * Queue Server — Express + Socket.io
 * - يخدم public/ كملفات ثابتة
 * - يعرّف مسارات صريحة للصفحات: /display, /examiner, /manager
 * - يدير الحالة (نداءات رجال/نساء، الغياب، الملاحظات)
 * - يتحقق من EXAM_CODE لعمليات الفاحص
 * - يتحقق من ADMIN_CODE لعمليات المدير
 */

const path = require('path');
const http = require('http');
const express = require('express');
const app = express();

const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: '*' },
});

// ====== إعدادات البيئة ======
const PORT = process.env.PORT || 10000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin';
let EXAM_CODE = process.env.EXAM_CODE || '1234';

// ====== خدمة الملفات الثابتة ======
app.use(express.static(path.join(__dirname, 'public')));

// مسارات صريحة للصفحات
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.get(['/display', '/display.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.get(['/examiner', '/examiner.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'examiner.html'));
});

app.get(['/manager', '/manager.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manager.html'));
});

// Healthcheck بسيط
app.get('/health', (_req, res) => res.status(200).send('OK'));

// ====== الحالة العامة للتطبيق ======
const state = {
  examCode: EXAM_CODE,
  // آخر نداء كبير يظهر بالوسط
  current: { gender: null, student: null, committee: null, at: 0 },
  // قوائم "تم النداء"
  calls: {
    MEN: [],   // [{student, committee, at}]
    WOMEN: [], // [{student, committee, at}]
  },
  // الغياب
  abs: {
    MEN: [],   // أرقام فقط
    WOMEN: [],
  },
  // ملاحظة متحركة
  note: '',     // نص
  noteBy: '',   // اسم الفاحص إن توفر
};

// حد أقصى لطول قوائم "تم النداء"
const MAX_LIST = 12;

// ====== دوال مساعدة ======
function normGender(g) {
  if (!g) return 'MEN';
  const s = String(g).toUpperCase();
  if (s.startsWith('W')) return 'WOMEN';
  if (s.includes('WOMEN') || s.includes('نساء')) return 'WOMEN';
  return 'MEN';
}
function toInt(x) {
  const n = parseInt(x, 10);
  return Number.isFinite(n) ? n : null;
}
function checkExamCode(code) {
  return String(code || '') === String(state.examCode);
}
function trimList(arr, max = MAX_LIST) {
  while (arr.length > max) arr.shift();
}
function buildPublicState() {
  // لا نعيد أكواد سرية؛ فقط الحالة العامة
  return {
    current: state.current,
    calls: {
      MEN: state.calls.MEN.slice(-MAX_LIST),
      WOMEN: state.calls.WOMEN.slice(-MAX_LIST),
    },
    abs: {
      MEN: [...state.abs.MEN],
      WOMEN: [...state.abs.WOMEN],
    },
    note: state.note,
    noteBy: state.noteBy,
  };
}
function broadcastState() {
  io.emit('state', buildPublicState());
}

// ====== Socket.io ======
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  // أرسل الحالة الحالية عند الاتصال
  socket.emit('state', buildPublicState());

  // نداء تلميذ
  socket.on('exam:call', (payload = {}) => {
    const { gender, student, committee, code } = payload;
    if (!checkExamCode(code)) return socket.emit('err', 'رمز الاختبار غير صحيح');

    const g = normGender(gender);
    const s = toInt(student);
    const c = toInt(committee);
    if (!s || !c) return socket.emit('err', 'أدخل رقم التلميذ واللجنة');

    // حدّث الحالية
    state.current = { gender: g, student: s, committee: c, at: Date.now() };

    // أضف للسجل
    state.calls[g].push({ student: s, committee: c, at: Date.now() });
    trimList(state.calls[g]);

    // بلّغ جميع الشاشات
    io.emit('call', { gender: g, student: s, committee: c, at: Date.now() });
    // لتشغيل نغمة في شاشة العرض
    io.emit('play', { gender: g });

    broadcastState();
  });

  // مسح القوائم (من الفاحص أو المدير)
  socket.on('exam:clear', (payload = {}) => {
    const { code } = payload;
    if (!checkExamCode(code)) return socket.emit('err', 'رمز الاختبار غير صحيح');

    state.current = { gender: null, student: null, committee: null, at: 0 };
    state.calls.MEN = [];
    state.calls.WOMEN = [];
    io.emit('cleared');
    broadcastState();
  });

  // إدارة الغياب — إضافة
  socket.on('exam:abs:add', (payload = {}) => {
    const { gender, number, code } = payload;
    if (!checkExamCode(code)) return socket.emit('err', 'رمز الاختبار غير صحيح');
    const g = normGender(gender);
    const n = toInt(number);
    if (!n) return;
    if (!state.abs[g].includes(n)) state.abs[g].push(n);
    broadcastState();
  });

  // إدارة الغياب — حذف رقم
  socket.on('exam:abs:remove', (payload = {}) => {
    const { gender, number, code } = payload;
    if (!checkExamCode(code)) return socket.emit('err', 'رمز الاختبار غير صحيح');
    const g = normGender(gender);
    const n = toInt(number);
    if (!n) return;
    state.abs[g] = state.abs[g].filter((x) => x !== n);
    broadcastState();
  });

  // إرسال ملاحظة
  socket.on('exam:note', (payload = {}) => {
    const { text, by, code } = payload;
    if (!checkExamCode(code)) return socket.emit('err', 'رمز الاختبار غير صحيح');
    state.note = String(text || '').slice(0, 400);
    state.noteBy = String(by || '').slice(0, 60);
    io.emit('note', { text: state.note, by: state.noteBy });
    broadcastState();
  });

  // ===== عمليات المدير =====
  socket.on('admin:setExam', (payload = {}) => {
    const { admin, exam } = payload;
    if (String(admin || '') !== String(ADMIN_CODE)) {
      return socket.emit('err', 'رمز المدير غير صحيح');
    }
    const ex = String(exam || '').trim();
    if (!ex) return socket.emit('err', 'أدخل EXAM_CODE صحيح');
    EXAM_CODE = ex;
    state.examCode = ex;
    io.emit('admin:exam:set', { exam: ex });
    console.log('EXAM_CODE updated ->', ex);
  });

  socket.on('admin:clearAll', (payload = {}) => {
    const { admin } = payload;
    if (String(admin || '') !== String(ADMIN_CODE)) return;
    state.current = { gender: null, student: null, committee: null, at: 0 };
    state.calls.MEN = [];
    state.calls.WOMEN = [];
    io.emit('cleared');
    broadcastState();
  });

  socket.on('admin:resetAbs', (payload = {}) => {
    const { admin } = payload;
    if (String(admin || '') !== String(ADMIN_CODE)) return;
    state.abs.MEN = [];
    state.abs.WOMEN = [];
    broadcastState();
  });

  socket.on('admin:note:clear', (payload = {}) => {
    const { admin } = payload;
    if (String(admin || '') !== String(ADMIN_CODE)) return;
    state.note = '';
    state.noteBy = '';
    io.emit('note', { text: '', by: '' });
    broadcastState();
  });

  socket.on('disconnect', () => {
    // لا شيء خاص عند قطع الاتصال
  });
});

// ====== تشغيل الخادم ======
server.listen(PORT, '0.0.0.0', () => {
  console.log('=====================================================');
  console.log(`Queue server running on http://localhost:${PORT}`);
  console.log(`Exam code (EXAM_CODE): ${EXAM_CODE}`);
  console.log('=====================================================');
});
