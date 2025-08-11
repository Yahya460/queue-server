// server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const EXAM_CODE = process.env.EXAM_CODE || '1234';

app.use(express.static(path.join(__dirname, 'public')));

// ---------------------- أدوات مساعدة ----------------------
function normGender(g) {
  // توحيد النوع: يقبل MEN/رجال/WOMEN/نساء... الخ
  g = (g || '').toString().trim().toUpperCase();
  if (g.includes('WOM') || g.includes('نس')) return 'WOMEN';
  return 'MEN';
}
function toInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

// ---------------------- سـوكِت ----------------------
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  // نداء تلميذ
  socket.on('exam:call', (payload = {}) => {
    try {
      const code = (payload.code || '').toString().trim();
      if (code !== EXAM_CODE) {
        console.log('call: invalid code');
        return;
      }
      const gender = normGender(payload.gender);
      const student = toInt(payload.student);
      const committee = toInt(payload.committee);
      if (!student || !committee) return;

      const msg = { gender, student, committee, at: Date.now() };
      // البث لشاشة العرض
      io.emit('exam:called', msg);        // عام (تستخدمه الشاشة للتحديث + النغمة)
      io.emit(`exam:called:${gender}`, msg); // فردي حسب النوع (احتياطي لو الشاشة تفصل)

      console.log('CALL:', msg);
    } catch (e) {
      console.error('exam:call error', e);
    }
  });

  // مسح القوائم
  socket.on('exam:clear', (payload = {}) => {
    const code = (payload.code || '').toString().trim();
    if (code !== EXAM_CODE) return;
    io.emit('exam:clear');
    console.log('CLEAR lists');
  });

  // الغياب - إضافة
  socket.on('exam:abs:add', (payload = {}) => {
    const code = (payload.code || '').toString().trim();
    if (code !== EXAM_CODE) return;
    const gender = normGender(payload.gender);
    const number = toInt(payload.number);
    if (!number) return;
    io.emit('exam:abs', { action: 'add', gender, number, at: Date.now() });
    console.log('ABS ADD:', gender, number);
  });

  // الغياب - حذف
  socket.on('exam:abs:remove', (payload = {}) => {
    const code = (payload.code || '').toString().trim();
    if (code !== EXAM_CODE) return;
    const gender = normGender(payload.gender);
    const number = toInt(payload.number);
    if (!number) return;
    io.emit('exam:abs', { action: 'remove', gender, number, at: Date.now() });
    console.log('ABS REMOVE:', gender, number);
  });

  // إرسال ملاحظة
  socket.on('exam:note', (payload = {}) => {
    const code = (payload.code || '').toString().trim();
    if (code !== EXAM_CODE) return;
    const text = (payload.text || '').toString().trim();
    io.emit('exam:note', { text, at: Date.now() });
    console.log('NOTE:', text);
  });
});

// ---------------------- تشغيل ----------------------
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Queue server running on http://localhost:${PORT}`);
  console.log(`Exam code (EXAM_CODE): ${EXAM_CODE}`);
});
