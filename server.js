
/* Queue Server (Express + Socket.IO) — Plus Edition
 * مزامنة شاشة العرض مع واجهات الفاحص عبر الشبكة/الإنترنت.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const EXAM_CODE = process.env.EXAM_CODE || '1234';
const STATE_FILE = path.join(__dirname, 'state.json');

// الحالة العامة
const state = { men: [], women: [], absMen: [], absWomen: [], notes: [] };
const MAX_ITEMS = 12;

// تحميل حالة سابقة إن وجدت
try {
  if (fs.existsSync(STATE_FILE)) {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    Object.assign(state, data || {});
  }
} catch (e) { console.error('State load error:', e.message); }
function persist() {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch(e){}
}

// جمع عناوين الشبكة
function getIPs() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}

// خادم HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

io.on('connection', (socket) => {
  socket.emit('state', state);

  socket.on('exam:call', (payload) => {
    if (!payload || payload.code !== EXAM_CODE) return;
    const { gender, student, committee } = payload;
    if (!student || !committee || !gender) return;
    const rec = { gender, student: parseInt(student,10), committee: parseInt(committee,10), ts: Date.now() };
    if (gender === 'men') { state.men.unshift(rec); state.men = state.men.slice(0, MAX_ITEMS); }
    else { state.women.unshift(rec); state.women = state.women.slice(0, MAX_ITEMS); }
    persist();
    io.emit('state', state);
    io.emit('play', { gender });
  });

  socket.on('exam:clear', (payload) => {
    if (!payload || payload.code !== EXAM_CODE) return;
    state.men = []; state.women = []; persist(); io.emit('state', state);
  });

  socket.on('exam:abs_add', (payload) => {
    if (!payload || payload.code !== EXAM_CODE) return;
    const { gender, number } = payload;
    const n = parseInt(number, 10); if (Number.isNaN(n)) return;
    const arr = (gender === 'men') ? state.absMen : state.absWomen;
    if (!arr.map(String).includes(String(n))) arr.push(n);
    persist(); io.emit('state', state);
  });

  socket.on('exam:abs_remove', (payload) => {
    if (!payload || payload.code !== EXAM_CODE) return;
    const { gender, number } = payload;
    const n = parseInt(number, 10); if (Number.isNaN(n)) return;
    if (gender === 'men') state.absMen = state.absMen.filter(x => String(x) !== String(n));
    else state.absWomen = state.absWomen.filter(x => String(x) !== String(n));
    persist(); io.emit('state', state);
  });

  socket.on('exam:note_add', (payload) => {
    if (!payload || payload.code !== EXAM_CODE) return;
    const { text, author, role } = payload;
    const t = (text || '').trim(); if (!t) return;
    state.notes.push({ text: t, author: author || '-', role: role || 'examiner', ts: Date.now() });
    state.notes = state.notes.slice(-100);
    persist(); io.emit('state', state);
  });

  socket.on('exam:note_remove', (payload) => {
    if (!payload || payload.code !== EXAM_CODE) return;
    const { ts } = payload || {};
    state.notes = state.notes.filter(n => String(n.ts) !== String(ts));
    persist(); io.emit('state', state);
  });

  socket.on('exam:note_clear_all', (payload) => {
    if (!payload || payload.code !== EXAM_CODE) return;
    state.notes = []; persist(); io.emit('state', state);
  });
});

// تقديم الواجهات
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req,res)=>res.redirect('/display.html'));
app.get('/display', (req,res)=>res.redirect('/display.html'));
app.get('/exam', (req,res)=>res.redirect('/examiner.html'));

// APIs مساعدة
app.get('/api/ips', (req,res)=>res.json({ ips: getIPs(), port: PORT }));

server.listen(PORT, () => {
  console.log(`Queue server running on http://localhost:${PORT}`);
  console.log(`Exam code (EXAM_CODE): ${EXAM_CODE}`);
  console.log('IPs:', getIPs().map(ip=>`http://${ip}:${PORT}/exam`).join(' , '));
});
