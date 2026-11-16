const express = require('express');
const fs = require('fs');
const app = express();
const http = require('http').createServer(app);

app.use(express.json({ limit: '10mb' }));

const ROOM_PASSWORD = "mn"; // 🔑 كلمة مرور الغرفة
const DATA_FILE = './messages.json';

function loadMessages() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            let messages = JSON.parse(data);
            
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            messages = messages.filter(msg => msg.timestamp && msg.timestamp > oneDayAgo);
            
            saveMessages(messages);
            return messages;
        }
    } catch (e) {
        console.error("خطأ:", e);
    }
    return [];
}

function saveMessages(messages) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), 'utf8');
    } catch (e) {}
}

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>غرفة آمنة</title>
        <style>
            * { box-sizing: border-box; }
            body { background: #0b0f19; color: #fff; font-family: sans-serif; margin: 0; display: flex; flex-direction: column; height: 100vh; }
            header { background: #111827; padding: 15px; text-align: center; color: #10b981; font-weight: bold; font-size: 1.1rem; border-bottom: 1px solid #1f2937; }
            #box { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
            .msg { background: #1f2937; padding: 12px 15px; border-radius: 12px; max-width: 85%; word-break: break-word; font-size: 0.95rem; line-height: 1.4; }
            .msg.me { align-self: flex-start; background: #059669; }
            .msg img { max-width: 100%; border-radius: 8px; margin-top: 5px; display: block; cursor: pointer; }
            .time { font-size: 0.75rem; color: #9ca3af; display: block; margin-top: 4px; text-align: left; }
            
            #foot { display: flex; padding: 12px; background: #111827; border-top: 1px solid #1f2937; gap: 10px; align-items: center; }
            input[type="text"] { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #374151; background: #0b0f19; color: #fff; outline: none; font-size: 1rem; }
            
            .file-btn { background: #374151; color: #fff; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; }
            input[type="file"] { display: none; }
            
            button.send-btn { padding: 12px 20px; border-radius: 8px; border: none; background: #10b981; color: #fff; font-weight: bold; cursor: pointer; font-size: 1rem; }
            button:active { opacity: 0.8; }
            
            #auth-screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #0b0f19; display: flex; justify-content: center; align-items: center; z-index: 999; }
            .auth-card { background: #111827; padding: 25px; border-radius: 15px; border: 1px solid #1f2937; width: 90%; max-width: 350px; text-align: center; display: flex; flex-direction: column; gap: 15px; }
            
            .auth-card input { 
                width: 100%; 
                text-align: center; 
                padding: 12px;
                border-radius: 8px;
                border: 1px solid #374151;
                background: #0b0f19 !important;
                color: #fff !important;
                outline: none;
                font-size: 1rem;
            }
            .auth-card input:-webkit-autofill {
                -webkit-box-shadow: 0 0 0 30px #0b0f19 inset !important;
                -webkit-text-fill-color: #fff !important;
            }

            .auth-card button { width: 100%; padding: 12px; border-radius: 8px; border: none; background: #10b981; color: #fff; font-weight: bold; cursor: pointer; font-size: 1rem; }
        </style>
    </head>
    <body>

        <!-- شاشة الباسورد -->
        <div id="auth-screen">
            <div class="auth-card">
                <h3>🔒 غرفة محمية</h3>
                <input type="password" id="pass-input" placeholder="أدخل كلمة المرور...">
                <input type="text" id="name-input" placeholder="اختر اسمك المستعار...">
                <button onclick="login()">دخول للشات</button>
            </div>
        </div>

        <header>🟢 شات آمن</header>
        <div id="box"></div>
        
        <div id="foot">
            <label class="file-btn">
                📷 
                <input type="file" id="image-input" accept="image/*" onchange="sendImage()">
            </label>
            <input type="text" id="m" placeholder="اكتب رسالتك..." onkeypress="if(event.key==='Enter')sendText()">
            <button class="send-btn" onclick="sendText()">إرسال</button>
        </div>

        <script>
            let name = "";

            window.onload = function() {
                let savedName = sessionStorage.getItem('cn');
                let isAuth = sessionStorage.getItem('ca');

                if(isAuth === 'true' && savedName) {
                    name = savedName;
                    document.getElementById('auth-screen').style.display = 'none';
                    load();
                    setInterval(load, 1000);
                }
            };

            function login() {
                let enteredPass = document.getElementById('pass-input').value;
                let enteredName = document.getElementById('name-input').value.trim();

                if(enteredPass !== "${ROOM_PASSWORD}") {
                    alert("❌ كلمة المرور غير صحيحة!");
                    return;
                }
                if(!enteredName) {
                    alert("⚠️ الرجاء إدخال اسمك!");
                    return;
                }

                sessionStorage.setItem('ca', 'true');
                sessionStorage.setItem('cn', enteredName);

                name = enteredName;
                document.getElementById('auth-screen').style.display = 'none';
                load();
                setInterval(load, 1000);
            }

            let lastLen = 0;
            async function load() {
                try {
                    let res = await fetch('/messages');
                    let data = await res.json();
                    if(data.length !== lastLen) {
                        lastLen = data.length;
                        let box = document.getElementById('box');
                        box.innerHTML = data.map(d => {
                            let imgTag = d.image ? '<img src="' + d.image + '" onclick="window.open(this.src)">' : '';
                            let textTag = d.text ? '<span>' + d.text + '</span>' : '';
                            return '<div class="msg ' + (d.name === name ? 'me' : '') + '"><b>' + d.name + ':</b> ' + textTag + imgTag + '<span class="time">' + (d.time || '') + '</span></div>';
                        }).join('');
                        box.scrollTop = box.scrollHeight;
                    }
                } catch(e) {}
            }

            async function sendText() {
                let inp = document.getElementById('m');
                let text = inp.value.trim();
                if(!text) return;
                inp.value = '';
                await fetch('/send', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name, text: text.substring(0, 300) })
                });
                load();
            }

            function sendImage() {
                let fileInput = document.getElementById('image-input');
                let file = fileInput.files[0];
                if (!file) return;

                let reader = new FileReader();
                reader.onload = async function(e) {
                    let base64Image = e.target.result;
                    await fetch('/send', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ name, image: base64Image })
                    });
                    fileInput.value = '';
                    load();
                };
                reader.readAsDataURL(file);
            }
        </script>
    </body>
    </html>
    `);
});

app.get('/messages', (req, res) => {
    const messages = loadMessages();
    res.json(messages);
});

app.post('/send', (req, res) => {
    const { name, text, image } = req.body;
    
    if (text || image) {
        let messages = loadMessages();
        const timeNow = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

        messages.push({ 
            name: (name || "مستخدم").substring(0, 15), 
            text: text ? text.substring(0, 300) : null,
            image: image || null,
            timestamp: Date.now(),
            time: timeNow
        });

        if(messages.length > 100) messages.shift();

        saveMessages(messages);
    }
    res.json({ status: "ok" });
});

http.listen(3000, () => {
    console.log('Server running securely.');
});
