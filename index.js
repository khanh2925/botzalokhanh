const ZaloBot = require('node-zalo-bot');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const pdf = require('pdf-parse');
const fetch = require('node-fetch');
require('dotenv').config({ path: './test.env' });

const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 Bot Zalo đã khởi động!");

// ====== TRẠNG THÁI IMPORT ======
let waitingForPdf = {}; // { chatId: true/false }

// ====== QUẢN LÝ LỊCH HỌC (đa người dùng) ======
function loadLichHoc() {
  if (fs.existsSync("lichhoc.json")) {
    let data = JSON.parse(fs.readFileSync("lichhoc.json"));
    if (Array.isArray(data)) {
      data = { "default": data };
    }
    return data;
  }
  return {};
}

function saveLichHoc(data) {
  fs.writeFileSync("lichhoc.json", JSON.stringify(data, null, 2));
  setupSchedules(data);
}

// ====== NHẮC LỊCH TỰ ĐỘNG ======
let jobs = [];
let reminders = {};

function setupSchedules(data) {
  jobs.forEach(job => job.cancel());
  jobs = [];

  Object.keys(data).forEach(chatId => {
    (data[chatId] || []).forEach(item => {
      const [hour, minute] = item.time.split(":");
      if (isNaN(hour) || isNaN(minute)) return;

      const job = schedule.scheduleJob(
        { hour: parseInt(hour), minute: parseInt(minute) },
        () => {
          const key = `${chatId}_${item.subject}`;
          if (reminders[key]) return;
          bot.sendMessage(chatId, `⏰ Đến giờ học: ${item.subject}\n👉 Gõ /done để xác nhận.`);
          const intervalId = setInterval(() => {
            bot.sendMessage(chatId, `⏰ Nhắc lại: ${item.subject}\n👉 Gõ /done để xác nhận.`);
          }, 30 * 1000);
          reminders[key] = intervalId;
        }
      );
      jobs.push(job);
    });
  });
}

// ====== MENU ======
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📚 MENU BOT
/themlich [giờ] [môn] - Thêm lịch
/lichhoc - Xem lịch học
/xoalich [số] - Xóa lịch
/import - Import lịch từ file PDF
/done - Xác nhận đã học
/joke - Nghe 1 câu đùa
/nhac [tên bài] - Tìm nhạc YouTube
/help - Hướng dẫn chi tiết
  `);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
ℹ️ Hướng dẫn:
/themlich 09:00 Toán → thêm lịch
/lichhoc → xem danh sách
/xoalich 1 → xóa lịch số 1
/import → gửi file PDF lịch học
/done → dừng nhắc
/joke → câu đùa
/nhac Sơn Tùng → tìm nhạc
  `);
});

// ====== LỊCH HỌC ======
bot.onText(/\/lichhoc/, (msg) => {
  const data = loadLichHoc();
  const lich = data[msg.chat.id] || [];
  if (lich.length === 0) {
    return bot.sendMessage(msg.chat.id, "📭 Chưa có lịch học nào.");
  }
  let text = "📅 Lịch học của bạn:\n";
  lich.forEach((l, i) => text += `${i + 1}. ⏰ ${l.time} → ${l.subject}\n`);
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/themlich (.+)/, (msg, match) => {
  const input = match[1];
  const parts = input.split(" ");
  const time = parts.shift();
  const subject = parts.join(" ");

  if (!time || !subject) {
    return bot.sendMessage(msg.chat.id, "❌ Sai cú pháp.\nVD: /themlich 09:00 Lập trình Web");
  }

  let data = loadLichHoc();
  if (!data[msg.chat.id]) data[msg.chat.id] = [];
  data[msg.chat.id].push({ time, subject });
  saveLichHoc(data);

  bot.sendMessage(msg.chat.id, `✅ Đã thêm lịch: ${time} - ${subject}`);
});

bot.onText(/\/xoalich (.+)/, (msg, match) => {
  const index = parseInt(match[1]) - 1;
  let data = loadLichHoc();
  let lich = data[msg.chat.id] || [];

  if (index >= 0 && index < lich.length) {
    const removed = lich.splice(index, 1);
    data[msg.chat.id] = lich;
    saveLichHoc(data);
    bot.sendMessage(msg.chat.id, `🗑️ Đã xóa lịch: ${removed[0].time} - ${removed[0].subject}`);
  } else {
    bot.sendMessage(msg.chat.id, "❌ Không tìm thấy lịch với số thứ tự đó.");
  }
});

// ====== IMPORT LỊCH TỪ PDF ======
bot.onText(/\/import/, (msg) => {
  waitingForPdf[msg.chat.id] = true;
  bot.sendMessage(msg.chat.id, "📂 Vui lòng gửi file PDF lịch học (tin nhắn kế tiếp).");
});

bot.on('message', async (msg) => {
  if (waitingForPdf[msg.chat.id] && msg.attachment && msg.attachment.type === 'file') {
    try {
      const mediaId = msg.attachment.payload.id; // ID file từ Zalo

      // Gọi API lấy link download
      const url = `https://openapi.zalo.me/v2.0/oa/getmedia?access_token=${process.env.BOT_TOKEN}&message_id=${mediaId}`;
      const res = await fetch(url);
      const result = await res.json();

      if (!result.data || !result.data.url) {
        return bot.sendMessage(msg.chat.id, "❌ Không lấy được file từ Zalo.");
      }

      // Tải file PDF về VPS
      const fileUrl = result.data.url;
      const pdfPath = path.join(__dirname, "imported.pdf");
      const fileRes = await fetch(fileUrl);
      const fileBuffer = await fileRes.buffer();
      fs.writeFileSync(pdfPath, fileBuffer);

      // Đọc PDF
      const dataBuffer = fs.readFileSync(pdfPath);
      const dataPdf = await pdf(dataBuffer);
      const text = dataPdf.text;

      // Parse text đơn giản
      let lich = [];
      text.split("\n").forEach(line => {
        if (line.includes("Tiết")) {
          const subject = line.split("Tiết")[0].trim();
          // TODO: sau này quy đổi "Tiết" thành giờ
          lich.push({ time: "07:30", subject });
        }
      });

      // Lưu vào lịch của user
      let dataAll = loadLichHoc();
      dataAll[msg.chat.id] = lich;
      saveLichHoc(dataAll);

      bot.sendMessage(msg.chat.id, `✅ Đã import ${lich.length} lịch học từ PDF.`);
    } catch (err) {
      console.error(err);
      bot.sendMessage(msg.chat.id, "❌ Lỗi khi xử lý file PDF.");
    } finally {
      waitingForPdf[msg.chat.id] = false;
    }
  }
});

// ====== DONE ======
bot.onText(/\/done/, (msg) => {
  const chatId = msg.chat.id;
  Object.keys(reminders).forEach(key => {
    if (key.startsWith(`${chatId}_`)) {
      clearInterval(reminders[key]);
      delete reminders[key];
      bot.sendMessage(chatId, "✅ Bạn đã xác nhận, bot sẽ dừng nhắc.");
    }
  });
});

// ====== JOKE ======
bot.onText(/\/joke/, (msg) => {
  const jokes = [
    "😂 Debug code giống như tìm kim trong đống cỏ.",
    "💡 Code chạy lần 1 mà đúng thì chắc chắn là may mắn.",
    "🐱‍💻 Người yêu cũ như bug, fix hoài không hết."
  ];
  bot.sendMessage(msg.chat.id, jokes[Math.floor(Math.random() * jokes.length)]);
});

// ====== NGHE NHẠC ======
bot.onText(/\/nhac (.+)/, (msg, match) => {
  const query = match[1];
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  bot.sendMessage(msg.chat.id, `🎶 Bạn tìm nhạc: ${query}\n👉 ${url}`);
});

// ====== DEFAULT ======
bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith("/") && !msg.attachment) {
    bot.sendMessage(msg.chat.id, "🤔 Tôi chưa hiểu, hãy gõ /start để xem lệnh nhé!");
  }
});

setupSchedules(loadLichHoc());
