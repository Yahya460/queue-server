🌍 نشر نظام الدور الآلي على الإنترنت — باقة جاهزة
التاريخ: 2025-08-10 13:03

المحتويات:
- server.js + package.json + public/ (واجهة العرض والفاحص)
- Dockerfile  ← للنشر عبر أي استضافة حاويات
- render.yaml ← نشر سريع على Render.com (مجاني غالبًا)
- Procfile    ← للنشر على منصات Heroku/Render
- ecosystem.config.js (PM2) + مثال إعداد Nginx
- README_DEPLOY_INTERNET_AR.txt (هذا الملف)

العناوين بعد النشر:
- شاشة العرض:   https://YOUR-DOMAIN/display
- واجهة الفاحص: https://YOUR-DOMAIN/exam
- روابط الهواتف في الشبكة المحلية فقط: https://YOUR-DOMAIN/phones (اختياري)

──────────────────────────────────────────

الخيار A) Render.com (الأسهل)
1) ارفع هذا المجلد إلى GitHub (Repo خاص أو عام).
2) في Render → New → Web Service → اربط بالمستودع.
3) Render يقرأ package.json تلقائيًا:
   • Build Command:  npm install
   • Start Command:  node server.js
4) أضف متغيّرات البيئة (Environment):
   • EXAM_CODE = 1234   ← غيّره كما تشاء
   • PORT = 3000
5) بعد التهيئة سيعطيك رابط مثل:
   https://queue-server.onrender.com
   استخدم:
   • https://.../display  لشاشة العرض
   • https://.../exam     للهواتف
6) اختبر الصوت في شاشة العرض (اضغط "تفعيل الصوت" مرة واحدة).

الخيار B) Docker (على أي خادم/VPS)
1) انسخ الملفات إلى الخادم وشغّل:
   docker build -t queue-server .
   docker run -d --name queue -p 3000:3000 -e EXAM_CODE=1234 queue-server
2) اربط دومين عبر Nginx كوكيل عكسي (ملف المثال مرفق). ثم SSL:
   sudo ln -s /etc/nginx/sites-available/queue-server.conf /etc/nginx/sites-enabled/
   sudo systemctl reload nginx
   sudo certbot --nginx -d your-domain.example.com

الخيار C) VPS عادي (Node + PM2 + Nginx)
1) على Ubuntu:
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
2) انسخ المشروع ثم:
   npm ci --omit=dev
   EXAM_CODE=1234 PORT=3000 pm2 start ecosystem.config.js
   pm2 save && pm2 startup
3) ضع ملف Nginx (المثال مرفق)، ثم SSL عبر certbot كما بالأعلى.

الخيار D) تجربة سريعة عبر ngrok (بدون دومين دائم)
1) شغّل محليًا: npm install && EXAM_CODE=1234 npm start
2) في نافذة أخرى: ngrok http 3000
3) شارك رابط ngrok للفاحصين: https://....ngrok-free.app/exam

ملاحظات مهمة:
• غيّر قيمة EXAM_CODE واحتفظ بها بين الفاحصين فقط.
• يدعم WebSocket (Socket.IO) افتراضيًا في Render/Docker/Nginx (مع التهيئة الصحيحة).
• لا تنس الضغط على زر "تفعيل الصوت" في شاشة العرض عند أول تشغيل في المتصفح.

لدعم إضافي (QR/مستخدمين منفصلين/تقارير)، أخبرني أضيفها لك.