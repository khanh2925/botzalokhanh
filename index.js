const ZaloBot = require('node-zalo-bot');
const fs = require('fs');
require('dotenv').config({ path: './test.env' });

const bot = new ZaloBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 Bot Zalo đã khởi động!");

// ====== HÀM QUẢN LÝ LỊCH HỌC ======
function loadLichHoc() {
  if (fs.existsSync("lichhoc.json")) {
    return JSON.parse(fs.readFileSync("lichhoc.json"));
  }
  return [];
}

function saveLichHoc(data) {
  fs.writeFileSync("lichhoc.json", JSON.stringify(data, null, 2));
}

// ====== MENU CHÍNH ======
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📚 MENU BOT
/start - Hiển thị menu
/lichhoc - Xem lịch học
/themlich [giờ] [môn học] - Thêm lịch học (VD: /themlich 9:00 Toán cao cấp)
/xoalich [số thứ tự] - Xóa lịch học
/joke - Nghe một câu đùa
/nhac [tên bài] - Nghe nhạc YouTube
/help - Hướng dẫn chi tiết
  `);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
ℹ️ Hướng dẫn chi tiết:
/themlich [giờ] [môn] → Thêm lịch học (VD: /themlich 14:00 Lập trình Web)
/lichhoc → Xem danh sách lịch học
/xoalich [số thứ tự] → Xóa lịch (VD: /xoalich 1)
/joke → Nghe một câu đùa
/nhac [tên bài] → Tìm nhạc trên YouTube (VD: /nhac Sơn Tùng)
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
    return bot.sendMessage(msg.chat.id, "❌ Sai cú pháp.\nVí dụ: /themlich 9:00 Cấu trúc dữ liệu");
  }
  const lich = loadLichHoc();
  lich.push({ time, subject });
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
    "💡 Lập trình viên và bug giống nhau: càng tránh thì càng gặp!",
    "😂 Người yêu cũ như bug trong code, fix xong rồi vẫn hiện lại!",
    "🐱‍💻 Debug code giống như tìm kim trong đống cỏ, mà kim lại tự di chuyển!"
  ];
  const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
  bot.sendMessage(msg.chat.id, randomJoke);
});

// ====== NGHE NHẠC ======
bot.onText(/\/nhac (.+)/, (msg, match) => {
  const query = match[1];
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  bot.sendMessage(msg.chat.id, `🎶 Bạn tìm nhạc: *${query}*\n👉 ${url}`);
});

// ====== DEFAULT ======
bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith("/")) {
    bot.sendMessage(msg.chat.id, "🤔 Tôi chưa hiểu, hãy gõ /help để xem lệnh nhé!");
  }
});
