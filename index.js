const ZaloBot = require('node-zalo-bot');
const fs = require('fs');
const schedule = require('node-schedule');
require('dotenv').config({ path: './test.env' });

const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 Bot Zalo đã khởi động!");

// ====== QUẢN LÝ LỊCH HỌC ======
function loadLichHoc() {
  if (fs.existsSync("lichhoc.json")) {
    return JSON.parse(fs.readFileSync("lichhoc.json"));
  }
  return [];
}

function saveLichHoc(data) {
  fs.writeFileSync("lichhoc.json", JSON.stringify(data, null, 2));
  setupSchedules(data); // Cập nhật lại nhắc nhở
}

// ====== NHẮC LỊCH TỰ ĐỘNG ======
let jobs = [];

function setupSchedules(data) {
  // Hủy job cũ
  jobs.forEach(job => job.cancel());
  jobs = [];

  data.forEach((item) => {
    const [hour, minute] = item.time.split(":");
    if (isNaN(hour) || isNaN(minute)) return;

    const job = schedule.scheduleJob(
      { hour: parseInt(hour), minute: parseInt(minute) },
      () => {
        bot.sendMessage(item.chatId, `⏰ Nhắc nhở: ${item.subject}`);
      }
    );
    jobs.push(job);
  });
}

// ====== MENU ======
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📚 MENU BOT
/start - Hiển thị menu
/lichhoc - Xem lịch học
/themlich [giờ] [môn] - Thêm lịch (VD: /themlich 09:00 Toán cao cấp)
/xoalich [số] - Xóa lịch
/joke - Nghe 1 câu đùa
/nhac [tên bài] - Tìm nhạc YouTube
/help - Hướng dẫn chi tiết
  `);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
ℹ️ Hướng dẫn:
/themlich [giờ] [môn] → Thêm lịch học (VD: /themlich 14:30 Lập trình Web)
/lichhoc → Xem danh sách lịch học
/xoalich [số] → Xóa lịch theo số thứ tự
/joke → Kể chuyện cười
/nhac [tên bài] → Tìm nhạc trên YouTube
  `);
});

// ====== LỊCH HỌC ======
bot.onText(/\/lichhoc/, (msg) => {
  const lich = loadLichHoc();
  if (lich.length === 0) {
    return bot.sendMessage(msg.chat.id, "📭 Chưa có lịch học nào.");
  }
  let text = "📅 Lịch học của bạn:\n";
  lich.forEach((l, i) => {
    text += `${i + 1}. ⏰ ${l.time} → ${l.subject}\n`;
  });
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
  const lich = loadLichHoc();
  lich.push({ time, subject, chatId: msg.chat.id });
  saveLichHoc(lich);
  bot.sendMessage(msg.chat.id, `✅ Đã thêm lịch: ${time} - ${subject}`);
});

bot.onText(/\/xoalich (.+)/, (msg, match) => {
  const index = parseInt(match[1]) - 1;
  const lich = loadLichHoc();
  if (index >= 0 && index < lich.length) {
    const removed = lich.splice(index, 1);
    saveLichHoc(lich);
    bot.sendMessage(msg.chat.id, `🗑️ Đã xóa lịch: ${removed[0].time} - ${removed[0].subject}`);
  } else {
    bot.sendMessage(msg.chat.id, "❌ Không tìm thấy lịch với số thứ tự đó.");
  }
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

// Load lịch khi khởi động bot
setupSchedules(loadLichHoc());
