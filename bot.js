require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMINS = process.env.ADMINS.split(",").map(id => Number(id));
const GROUPS_FILE = "groups.json";

// Guruhlar ro‘yxatini yuklash
function loadGroups() {
  try {
    const data = fs.readFileSync(GROUPS_FILE, "utf-8");
    return JSON.parse(data).groups || [];
  } catch (err) {
    return [];
  }
}

// Yangi guruhni saqlash
function saveGroup(chatId) {
  const groups = loadGroups();
  if (!groups.includes(chatId)) {
    groups.push(chatId);
    fs.writeFileSync(GROUPS_FILE, JSON.stringify({ groups }, null, 2));
    console.log(`✅ Guruh qo‘shildi: ${chatId}`);
  }
}

// Kim botni guruhga qo‘shganini aniqlash va adminlarga xabar berish
bot.on("my_chat_member", async (ctx) => {
  const chat = ctx.chat;
  const update = ctx.update.my_chat_member;
  const newStatus = update.new_chat_member.status;

  if (chat.type.includes("group") && newStatus === "administrator") {
    saveGroup(chat.id);

    const from = update.from;
    const groupName = chat.title || "Noma'lum guruh";
    const fullName = `${from.first_name || ""} ${from.last_name || ""}`.trim();

    const message = `➕ <b>${fullName}</b> foydalanuvchi <b>${groupName}</b> guruhiga botni qo‘shdi.`;

    for (const adminId of ADMINS) {
      try {
        await bot.telegram.sendMessage(adminId, message, { parse_mode: "HTML" });
      } catch (e) {
        console.log("❌ Adminlarga yuborib bo‘lmadi:", e.description);
      }
    }
  }
});

// /start komandasi
bot.start(async (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) {
    return ctx.reply("🚫 Sizga ruxsat yo‘q.");
  }

  await ctx.reply(
    "Assalomu alaykum! Tugmani bosing:",
    Markup.keyboard([["📢 Xabar yuborish"]]).resize()
  );
});

const sessions = new Map();

// Tugma bosilganda xabar kutish
bot.hears("📢 Xabar yuborish", async (ctx) => {
  if (!ADMINS.includes(ctx.from.id)) return ctx.reply("🚫 Siz admin emassiz.");

  sessions.set(ctx.from.id, true);
  await ctx.reply("✍️ Yubormoqchi bo‘lgan xabaringizni yozing:");
});

// Xabar yozilganda
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMINS.includes(userId)) return;

  if (sessions.get(userId)) {
    const message = ctx.message.text;
    const groups = loadGroups();
    let count = 0;

    for (const groupId of groups) {
      try {
        await ctx.telegram.sendMessage(groupId, message);
        count++;
      } catch (e) {
        console.log("❌ Guruhga yuborilmadi:", e.description);
      }
    }

    await ctx.reply(`✅ Xabar ${count} ta guruhga yuborildi.`);
    sessions.delete(userId);
  }
});

// Botni ishga tushirish
bot.launch();
console.log("🤖 Bot ishga tushdi...");

// To‘xtatish holati
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
