// server.js — ثابت ومبسّط ليفتح الصفحات ويشغّل السوكِت
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 10000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ملفات الواجهة
app.use(express.static(path.join(__dirname, 'public')));

// مسارات صريحة للصفحات (مهم!)
app.get('/',        (req,res)=>res.redirect('/display'));
app.get('/display', (req,res)=>res.sendFile(path.join(__dirname,'public','display.html')));
app.get('/examiner',(req,res)=>res.sendFile(path.join(__dirname,'public','examiner.html')));
app.get('/manager', (req,res)=>res.sendFile(path.join(__dirname,'public','manager.html')));

// (اختياري) فحص سريع للصحة
app.get('/healthz', (req,res)=>res.send('ok'));

// قنوات السوكِت الأساسية — تكفي لتحديث شاشة العرض الآن
io.on('connection', (socket)=>{
  // النداء
  socket.on('exam:call',       (p)=> io.emit('play', p));
  // مسح القائمة
  socket.on('exam:clear',      ()=> io.emit('clear'));
  // الملاحظات
  socket.on('exam:note',       (p)=> io.emit('note', p));
  // الغياب (إضافة/حذف)
  socket.on('exam:abs:add',    (p)=> io.emit('abs:add', p));
  socket.on('exam:abs:remove', (p)=> io.emit('abs:remove', p));
});

server.listen(PORT, ()=>{
  console.log(`Queue server running on http://localhost:${PORT}`);
  console.log(`Exam code (EXAM_CODE): ${process.env.EXAM_CODE || 'not set'}`);
});
