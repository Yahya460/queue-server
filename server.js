// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { /* Socket.io defaults */ });

// ===== الإعدادات =====
const PORT = process.env.PORT || 10000;
// كود الفاحصين (يضبط من Render > Environment أو من .env محلياً)
const EXAM_CODE = process.env.EXAM_CODE || '1234';

// ===== الحالة في الذاكرة =====
const state = {
  men: [],         // [{student, committee, at}]
  women: [],       // [{student, committee, at}]
  abs: { MEN: [], WOMEN: [] },   // أرقام الغياب
  note: '',        // نص آخر ملاحظة
  last: null       // آخر نداء {gender, student, committee, at}
};

// طول القائمة لكل جنس
const MAX_LIST = 12;

// ===== تقديم الملفات الثابتة =====
app.use(express.static(path.join(__dirname, 'public')));

// اختصارات روابط الصفحات
app.get('/', (req, res) => res.redirect('/display.html'));
app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));
app.get('/examiner', (req, res) => res.sendFile(path.join(__dirname, 'public', 'examiner.html')));
app.get('/manager',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'manager.html')));

// ===== Socket.io =====
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  // أرسل الحالة الحالية عند الاتصال
  socket.emit('state', state);

  // فاحص/مدير أرسل نداء
  socket.on('exam:call', (payload) => {
    try {
      const { gender, student, committee, code } = payload || {};
      if (!code || code !== EXAM_CODE) return; // رفض لو الكود خطأ

      const rec = {
        student: String(student || '').trim(),
        committee: parseInt(committee, 10) || 1,
        at: Date.now()
      };
      if (!rec.student) return;

      if ((gender || '').toUpperCase() === 'MEN') {
        state.men.unshift(rec);
        while (state.men.length > MAX_LIST) state.men.pop();
      } else {
        state.women.unshift(rec);
        while (state.women.length > MAX_LIST) state.women.pop();
      }
      state.last = { gender: (gender || '').toUpperCase(), ...rec };

      // بث الحالة والتشغيل (للنغمة)
      io.emit('state', state);
      io.emit('display:update', state);
      io.emit('play', { gender: (gender || '').toUpperCase(), student: rec.student, committee: rec.committee, at: rec.at });
    } catch (e) { console.error(e); }
  });

  // مسح القوائم
  socket.on('exam:clear', () => {
    state.men = [];
    state.women = [];
    state.last = null;
    io.emit('state', state);
    io.emit('display:update', state);
  });

  // ملاحظة
  socket.on('exam:note', (payload) => {
    try {
      const { text, code } = payload || {};
      if (!code || code !== EXAM_CODE) return;
      state.note = String(text || '').trim();
      io.emit('state', state);
      io.emit('display:update', state);
    } catch (e) { console.error(e); }
  });

  // غياب: إضافة
  socket.on('exam:abs:add', (payload) => {
    try {
      const { gender, number, code } = payload || {};
      if (!code || code !== EXAM_CODE) return;

      const g = (gender || '').toUpperCase() === 'MEN' ? 'MEN' : 'WOMEN';
      const n = String(number || '').trim();
      if (!n) return;
      if (!state.abs[g].includes(n)) state.abs[g].push(n);
      io.emit('state', state);
      io.emit('display:update', state);
    } catch (e) { console.error(e); }
  });

  // غياب: حذف
  socket.on('exam:abs:remove', (payload) => {
    try {
      const { gender, number, code } = payload || {};
      if (!code || code !== EXAM_CODE) return;

      const g = (gender || '').toUpperCase() === 'MEN' ? 'MEN' : 'WOMEN';
      const n = String(number || '').trim();
      state.abs[g] = state.abs[g].filter(x => x !== n);
      io.emit('state', state);
      io.emit('display:update', state);
    } catch (e) { console.error(e); }
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
  });
});

// ===== تشغيل الخادم =====
server.listen(PORT, () => {
  console.log(`Queue server running on http://localhost:${PORT}`);
  console.log(`Exam code (EXAM_CODE): ${EXAM_CODE}`);
});
