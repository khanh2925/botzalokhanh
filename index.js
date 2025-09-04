const ZaloBot = require('node-zalo-bot');
const fs = require('fs');
const schedule = require('node-schedule');
const pdf = require('pdf-parse');
require('dotenv').config({ path: './test.env' });

const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 Bot Zalo đã khởi động!");

// ====== QUẢN LÝ LỊCH HỌC (đa người dùng) ======
function loadLichHoc() {
  if (fs.existsSync("lichhoc.json")) {
    return JSON.parse(fs.readFileSync("lichhoc.json"));
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
    data[chatId].forEach(item => {
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
/themlich [giờ] [môn] - Thêm lịch (VD: /themlich 09:00 Toán)
/lichhoc - Xem lịch học
/xoalich [số] - Xóa lịch
/import - Import lịch từ file PDF
/done - Xác nhận đã học, dừng nhắc
/joke - Nghe 1 câu đùa
/nhac [tên bài] - Tìm nhạc YouTube
/help - Hướng dẫn chi tiết
  `);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
ℹ️ Hướng dẫn:
/themlich 09:00 Toán → Thêm lịch
/lichhoc → Xem danh sách
/xoalich 1 → Xóa lịch số 1
/import → Gửi file PDF lịch học để bot tạo lịch tự động
/done → Dừng nhắc lịch
/joke → Câu đùa
/nhac Sơn Tùng → Tìm nhạc
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
bot.onText(/\/import/, async (msg) => {
  try {
    // ⚠️ Chỗ này cần xử lý file PDF upload từ Zalo, ví dụ tạm mình dùng sẵn 1 file trên VPS
    let dataBuffer = fs.readFileSync("download.pdf"); 
    let dataPdf = await pdf(dataBuffer);
    let text = dataPdf.text;

    let lich = [];
    const lines = text.split("\n");
    lines.forEach(line => {
      if (line.includes("Tiết")) {
        const subject = line.split("Tiết")[0].trim();
        // ⚠️ TODO: convert Tiết thành giờ cụ thể
        lich.push({ time: "07:30", subject });
      }
    });

    let dataAll = loadLichHoc();
    dataAll[msg.chat.id] = lich;
    saveLichHoc(dataAll);

    bot.sendMessage(msg.chat.id, `✅ Đã import ${lich.length} lịch học từ file PDF`);
  } catch (err) {
    console.error(err);
    bot.sendMessage(msg.chat.id, "❌ Lỗi khi đọc file PDF.");
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
  if (msg.text && !msg.text.startsWith("/")) {
    bot.sendMessage(msg.chat.id, "🤔 Tôi chưa hiểu, hãy gõ /start để xem lệnh nhé!");
  }
});

setupSchedules(loadLichHoc());
