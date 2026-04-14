// ====== PLAYER ROOMS - rooms where the bot is allowed ======
const ROOM_IDS = [];

// ====== ADMIN LIST - only these users can use The fool / إلغاء / قواعد ======
let ADMINS = [
  '100000307991292','100082195270090','61582742323034','61554094183100'
]

// ====== COMMANDS ======
// The fool    -> start game
// إلغاء       -> cancel game
// قواعد       -> show rules
// معرف        -> show room id
// أضف غرفة    -> add current room as private room
// حذف غرفة    -> remove current room from private rooms
// rem         -> remove member
// add         -> add member
// ادمن بوت    -> add bot admin
// شيل ادمن بوت -> remove bot admin

const fs = require('fs');
const path = require('path');
const { login } = require('@dongdev/fca-unofficial');
const aiModule = require('../ai');

// ---------- CONFIG ----------
const PLAYER_FILE = path.join(__dirname, 'data', 'player.json');
const GAMES_DIR   = path.join(__dirname, 'games');
const ROOMS_FILE  = path.join(__dirname, 'data', 'rooms.json');
const ADMINS_FILE = path.join(__dirname, 'data', 'bot_admins.json');
if(!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR, { recursive: true });
const DATA_DIR = path.join(__dirname, 'data');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load saved rooms
try {
  const saved = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'));
  if(Array.isArray(saved)) saved.forEach(id => { if(!ROOM_IDS.includes(id)) ROOM_IDS.push(id); });
} catch(_) {}

// Load saved bot admins (merge with hardcoded)
try {
  const saved = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
  if(Array.isArray(saved)) saved.forEach(id => { if(!ADMINS.includes(id)) ADMINS.push(id); });
} catch(_) {}

function saveRooms() {
  fs.writeFileSync(ROOMS_FILE, JSON.stringify(ROOM_IDS), 'utf8');
}

function saveAdmins() {
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(ADMINS), 'utf8');
}

const APPSTATE_FILE = path.join(__dirname, '..', 'appstate.json');
const CREDENTIALS   = { appState: JSON.parse(fs.readFileSync(APPSTATE_FILE, 'utf8')) };

const DEFAULTS = {
  joinWindowMs:  90 * 1000,
  nightWindowMs: 120 * 1000,
  dayWindowMs:   75 * 1000
};

// ---------- STRINGS ----------
const STR = {
  join:          `تفاعل يحمار`,
  roleDM:        (name, role, desc) => `━━━━━━━━━━━━━━━━\n${name} — دورك:\n━━━━━━━━━━━━━━━━\n『 ${role} 』\n\n${desc}`,
  nightPrompt:   (round, role, list) => `━━━━━━━━━━━━━━━━\n🌑 الليلة ${round} — ${role}\n━━━━━━━━━━━━━━━━\n${list}\n\nأرسل الرقم أو الاسم:`,
  dayPrompt:     (round, list) => `من سيقابل المشنقة ؟\n${list}`,
  actionReceived:`✅ وصل اختيارك.`,
  invalidTarget: `انت احول ؟`,
  noDeaths:      `يبدو أن المافيا غلبهم النوم يال المهزلة『 لا ضحايا—ليلة هادئة 』`,
  doctorSaved:   () => `حاول المافيا لاكن الطبيب له رأي آخر 『 إنقاذ اسطوري 』`,
  mafiaDeath:   (name, role) => {
    const msgs = [
      `سمع الناس صوت إطلاق نار...${name} جثة هامدة كان دوره 『 ${role} 』`,
      `في زقاق مظلم وجد ${name} مطعون بعنف كان دوره 『 ${role} 』`,
      `${name} لم ينجو من بطش المافيا كان دوره 『 ${role} 』`,
      `خرج المواطنون ولم يجدوا ${name} كان دوره 『 ${role} 』`
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  },
  voteResultMafia:  (name) => `سلطت كل الأصوات على  ${name}  كان مافيا`,
  voteResultCiv:    (name, role) => `تم إعدام ${name} لقد كان بريء دوره『${role}』`,
  voteResultJester: (name) => `اغبياء ! اعدمتم ${name}  لقد كان مهرج ضحك عليكم كما لو أنكم انعام`,
  sniperNightPrompt:(round, list) => `━━━━━━━━━━━━━━━━\n🎯 الليلة ${round} — القناص\n━━━━━━━━━━━━━━━━\nمن تستهدف برصاصتك الوحيدة؟\n${list}\n\nأرسل الرقم أو الاسم — رصاصة واحدة فقط طوال اللعبة:`,
  sniperResult:   (targetName, wasMafia) => wasMafia
    ? `القناص أطلق رصاصة اخترقت جمجمة ${targetName} ، والصدمة أنه مافياااا`
    : `القناص خان ثقة الجميع وقتل ${targetName} ، ستعيش بلا شرف`,
  loverPrompt:   (list) => `━━━━━━━━━━━━━━━━\n🧚 الخطابة — اختر شخصين\n━━━━━━━━━━━━━━━━\nأرسل رقميهما هكذا: 3+4\n${list}\n\nإذا مات أحدهما مات الآخر.`,
  loverNotified: (partnerName) => `━━━━━━━━━━━━━━━━\n💔 رابط الموت\n━━━━━━━━━━━━━━━━\nأنت مرتبط بـ ${partnerName}\nإذا مات — تموت معه.`,
  loverInvalidPair:   `⚠️ أرسل رقمين مختلفين وصحيحين، مثال: 3+4`,
  loverDeath:    (name, partnerName) => `بعد ${name} لم يتحمل ${partnerName} الم الفراق ومات معه 💔🕊️`,
  scpKill:       (name, killNumber) => {
    const msgs = [
      `يال الهول...${name} وجد بدون أحشاء، الفاعل ليس بشريا...☠️`,
      `${name} وجد بدون أطراف ، كتب بجانبه S..C...P☠️`,
      `صراخ من الغابة...مجددا ${name}بدون رأس ☠️`,
      `صوت صراخ scp...${name} كان ضحيته☠️`,
      `${name} جثة بدون ملامح ، scp دخل المدينة ☠️`
    ];
    return msgs[(killNumber - 1) % 5];
  },
  scpNightPrompt:(round, list) => `━━━━━━━━━━━━━━━━\n☣️ SCP-096 — الليلة ${round}\n━━━━━━━━━━━━━━━━\nمن سيرى وجهك الليلة؟\n${list}\n\nأرسل الرقم أو الاسم:`,
  sniperAlreadyUsed: `🎯 استخدمت رصاصتك بالفعل.`,
  nahabPrompt:   (round, list) => `━━━━━━━━━━━━━━━━\n🦹 الليلة ${round} — النهاب\n━━━━━━━━━━━━━━━━\nمن تسرق دوره الليلة؟\n${list}\n\nأرسل الرقم أو الاسم:`,
  nahabStole:    (targetName, role) => `━━━━━━━━━━━━━━━━\n🦹 نجحت السرقة\n━━━━━━━━━━━━━━━━\nسرقت دور ${targetName}\nدورك الجديد: 『 ${role} 』`,
  draculaPrompt:  (round, list) => `━━━━━━━━━━━━━━━━\n🧛 الليلة ${round} — دراكولا\n━━━━━━━━━━━━━━━━\nمن تحول إلى مصاص دماء؟\n${list}\n\nأرسل الرقم أو الاسم:`,
  draculaTransform: (targetName) => `تم عضك من قبل دراكولا ، تحولت لمصاص دماء 🧛‍♂️`,
  tie:           `تعادل في التصويت لا اعدام اليوم ⚖️`
};

// ---------- STORAGE ----------
let PLAYER_MAP = {};
function loadPlayerMap(){
  if(!fs.existsSync(PLAYER_FILE)) return;
  try{ PLAYER_MAP = JSON.parse(fs.readFileSync(PLAYER_FILE,'utf8')); }
  catch(e){ console.error('player.json error', e); }
}
loadPlayerMap();

const GAMES = {};

function saveGame(game){
  const { timers, ...data } = game;
  fs.writeFileSync(path.join(GAMES_DIR, `${game.id}.json`), JSON.stringify(data,null,2));
}


// ---------- HELPERS ----------
const NUM_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','1️⃣1️⃣','1️⃣2️⃣'];
function listText(players){ return players.map((p,i)=>`${NUM_EMOJIS[i]||`${i+1}.`} ${p.name}`).join('\n'); }

function aliveDeadText(game){
  const total = game.players.length;
  const aliveCount = game.players.filter(p=>p.alive).length;
  let body = `الاحياء : ${aliveCount}/${total}\n`;
  const mentions = [];
  for (const p of game.players) {
    const status = p.alive ? '🙂حي' : '💀ميت';
    mentions.push({ tag: p.name, id: p.userID, fromIndex: body.length });
    body += `${p.name} —${status}\n`;
  }
  return { body: body.trimEnd(), mentions };
}
function withMentions(text, ...pairs) {
  const mentions = [];
  let offset = 0;
  for (const [name, userID] of pairs) {
    if (!name || !userID) continue;
    const idx = text.indexOf(name, offset);
    if (idx !== -1) {
      mentions.push({ tag: name, id: userID, fromIndex: idx });
      offset = idx + name.length;
    }
  }
  return { body: text, mentions };
}

function resolveTarget(input, players){
  input = (''+input).trim();
  const n = parseInt(input);
  if(!isNaN(n) && n>=1 && n<=players.length) return players[n-1].userID;
  const low = input.toLowerCase();
  return players.find(p=>p.name.toLowerCase()===low)?.userID || null;
}

// ---------- ROLES ----------
const ROLE_DESCS = {
  'مافيا':   '😈 أنت من المافيا — تقتل في الليل وتتظاهر بالبراءة نهاراً.\nكل ليلة أرسل رقم أو اسم الشخص الذي تريد تصفيته.',
  'محقق':    '🕵️ دورك كشف الحقيقة — كل ليلة اختر لاعباً وستعرف إذا كان من المافيا أم لا.\nاستخدم المعلومات بذكاء في التصويت.',
  'طبيب':    '👨‍⚕️ تملك القدرة على إنقاذ الأرواح — كل ليلة اختر شخصاً واحداً تحميه من القتل.',
  'قناص':    '🎯 معك رصاصة واحدة فقط طوال اللعبة.\nكل ليلة يمكنك استخدامها — أرسل الرقم أو اسم هدفك في الخاص لتقتله مباشرة. قتلك يتجاوز الطبيب. فكّر جيداً قبل الضغط على الزناد.',
  'مهرج':    '🃏 أنت لا تريد الفوز بالطريقة التقليدية — هدفك أن يُصوّت الجميع ضدك ويُشنقوك.\nإذا أُعدمت بالتصويت، تفوز وحدك.',
  'جلاد':    '⛓️ قدرتك تقييد الآخرين — كل ليلة اختر لاعباً واحداً يُمنع من التصويت في اليوم التالي.\nاستهدف المشبوهين أو من تريد إسكاتهم.',
  'عالم مجنون': '🧪 تبدأ بجرعة الموت — أرسل رقم هدفك لتقتله فوراً والإعلان يصل للغرفة مباشرة.\nبعد استخدامها تظهر كبسولة الإحياء — أرسل رقم ميت لتعيده للحياة.\nكلٌّ منهما تُستخدم مرة واحدة فقط طوال اللعبة.',
  'خطابة':   '🧚 تملك قوة ربط مصيرين معاً — في الليل الأول فقط أرسل رقمين بالصيغة: 3+4\nإذا مات أي منهما مات الآخر فوراً، طوال بقية اللعبة.',
  'مواطن':   '👤 لا قدرة خاصة لديك — لكن صوتك في التصويت يمكن أن يُحدد مسار اللعبة.\nراقب، فكّر، وصوّت بحكمة.',
  'SCP-096': '☣️ كيانٌ لا يُوقف — كل ليلة اختر ضحية واحدة لتقتلها.\nقتلك يتجاوز حماية الطبيب تماماً، ولا شيء يحميهم منك.',
  'نهاب':    '🦹 كل ليلة اختر لاعباً وتسرق دوره — يصبح مواطناً وأنت تحمل دوره الجديد.\nتُطبَّق السرقة بعد انتهاء الليل، ابتداءً من الجولة التالية.',
  'دراكولا': '🧛 إمبراطور الليل — كل ليلة حول شخصاً إلى مصاص دماء يفقد قدرته الأصلية.\nإذا أصبح عدد مصاصي الدماء أكثر من باقي اللاعبين، تفوز أنت وجميع اتباعك معك!',
  'مصاص دماء': '🧛 تحولت إلى مصاص دماء — لا قدرات خاصة لديك الآن.\nفقط صوتك في النهار والفوز مع دراكولا إذا أصبحتم الأكثرية!'
};

function assignRoles(players){
  const n = players.length;
  const roles = Array(n).fill('مواطن');
  const mCount = Math.min(2, Math.max(1, Math.floor(n/4)));
  let i=0;
  while(i<mCount){
    const r=Math.floor(Math.random()*n);
    if(roles[r]!=='مافيا'){ roles[r]='مافيا'; i++; }
  }
  const civs = roles.map((r,idx)=>r==='مواطن'?idx:-1).filter(x=>x>=0);
  // shuffle civs for random special role distribution
  for(let j=civs.length-1;j>0;j--){ const k=Math.floor(Math.random()*(j+1)); [civs[j],civs[k]]=[civs[k],civs[j]]; }
  if(civs.length>=1) roles[civs[0]]='طبيب';
  if(civs.length>=2) roles[civs[1]]='محقق';
  if(civs.length>=3) roles[civs[2]]='قناص';
  if(civs.length>=4) roles[civs[3]]='مهرج';
  if(civs.length>=5) roles[civs[4]]='جلاد';
  // نهاب — يظهر فوق 6 لاعبين (civs[5])
  if(n > 6 && civs.length>=6) roles[civs[5]]='نهاب';
  // خطابة — يظهر فوق 8 لاعبين (civs[6])
  if(n > 8 && civs.length>=7) roles[civs[6]]='خطابة';
  // SCP-096 — يظهر فوق 8 لاعبين (civs[7])
  if(n > 8 && civs.length>=8) roles[civs[7]]='SCP-096';
  // دراكولا — يظهر فوق 12 لاعب (civs[8])
  if(n > 12 && civs.length>=9) roles[civs[8]]='دراكولا';
  // عالم مجنون — يظهر فوق 10 لاعبين (civs[9])
  if(n > 10 && civs.length>=10) roles[civs[9]]='عالم مجنون';
  players.forEach((p,i)=>p.role=roles[i]);
}

function triggerLoverDeath(game, deadPlayer){
  if(!deadPlayer || !game.loverLinks) return null;
  const partnerID = game.loverLinks[deadPlayer.userID];
  if(!partnerID) return null;
  const lover = game.players.find(p=>p.userID===partnerID && p.alive);
  if(!lover) return null;
  lover.alive = false;
  return lover;
}

// ---------- NIGHT RESOLUTION ----------
async function resolveNight(game){
  const byId = Object.fromEntries(game.players.map(p=>[p.userID,p]));
  const safe = new Set(); const dead = new Set();
  // Doctor
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='طبيب' && act.target) safe.add(act.target);
  }
  // Mafia — each member kills their own target independently
  // Same target voted by both = deduplication via Set (1 death only)
  // Different targets = 2 deaths
  let doctorSavedTarget = null;
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='مافيا' && act.target){
      if(safe.has(act.target)){ doctorSavedTarget = act.target; }
      else { dead.add(act.target); }
    }
  }
  // Guard — set blocked voters for next day
  game.blockedVoters = [];
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='جلاد' && act.target) game.blockedVoters.push(act.target);
  }
  // SCP-096 — kills bypass doctor protection
  const scpDead = new Set();
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='SCP-096' && act.target) scpDead.add(act.target);
  }
  const deaths=[];
  for(const d of dead){
    const p=byId[d]; if(p&&p.alive){
      p.alive=false;
      deaths.push({userID:d,name:p.name,role:p.role,byMafia:true});
      const lover = triggerLoverDeath(game, p);
      if(lover) deaths.push({userID:lover.userID,name:lover.name,role:lover.role,byLover:true,partnerName:p.name,partnerID:p.userID});
    }
  }
  for(const d of scpDead){
    const p=byId[d]; if(p&&p.alive){
      p.alive=false;
      deaths.push({userID:d,name:p.name,role:p.role,byScp:true});
      const lover = triggerLoverDeath(game, p);
      if(lover) deaths.push({userID:lover.userID,name:lover.name,role:lover.role,byLover:true,partnerName:p.name,partnerID:p.userID});
    }
  }
  // القناص — kills bypass doctor (one shot lifetime)
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='قناص' && act.target && !game.sniperUsed){
      game.sniperUsed = true;
      const p=byId[act.target];
      if(p && p.alive){
        p.alive=false;
        deaths.push({userID:act.target,name:p.name,role:p.role,bySniper:true,sniperID:uid});
        const lover = triggerLoverDeath(game, p);
        if(lover) deaths.push({userID:lover.userID,name:lover.name,role:lover.role,byLover:true,partnerName:p.name,partnerID:p.userID});
      } else {
        // Target already killed by another role — notify sniper, bullet wasted
        deaths.push({bySniper:true, sniperID:uid, name:p?p.name:'الهدف', role:p?p.role:'', wasted:true});
      }
    }
  }
  // النهاب — role swap (applied after all deaths this night)
  // السرقة تحدث في نفس وقت الأحداث الليلية — تنجح حتى لو مات الهدف في نفس الليلة
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='نهاب' && act.target){
      const target=byId[act.target];
      if(!game._nahabResults) game._nahabResults=[];
      if(target){
        const stolenRole = target.role;
        target.role = 'مواطن'; // الهدف يخسر دوره حتى لو مات
        a.role = stolenRole;
        game._nahabResults.push({
          nahabID: uid,
          targetName: target.name,
          stolenRole,
          targetDied: !target.alive // للإشارة في الرسالة فقط
        });
      }
    }
  }
  // دراكولا — تحويل الناس إلى مصاصي دماء
  if(!game._draculaTransformations) game._draculaTransformations = [];
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='دراكولا' && act.target){
      const target=byId[act.target];
      // لا يستطيع تحويل المافيا
      if(target && target.alive && target.role !== 'مافيا'){
        // تخزين أن هذا اللاعب تحول
        game._draculaTransformations.push({
          transformedID: act.target,
          transformedName: target.name,
          originalRole: target.role,
          draculaID: uid
        });
        // تغيير الدور إلى مصاص دماء
        target.role = 'مصاص دماء';
        // إرسال رسالة التحول فوراً
        await dm(act.target, STR.draculaTransform(target.name));
        // إرسال تأكيد لدراكولا
        await dm(uid, `تم تحويل ${target.name}`);
      } else if(target && target.alive && target.role === 'مافيا'){
        // إرسال رسالة فشل لدراكولا
        await dm(uid, `خارج نطاق الاستهداف`);
      }
    }
  }
  game.actionQueue={};
  return { deaths, doctorSavedTarget };
}

// ---------- WIN CHECK ----------
function checkWin(game){
  const alive = game.players.filter(p=>p.alive);
  const mafia = alive.filter(p=>p.role==='مافيا');
  const dracula = alive.filter(p=>p.role==='دراكولا');
  const vampires = alive.filter(p=>p.role==='مصاص دماء');
  
  // دراكولا و تابعوه يفوزون إذا أصبحوا الأكثرية
  if(dracula.length > 0){
    const vampireTeam = dracula.length + vampires.length;
    const others = alive.length - vampireTeam;
    if(vampireTeam >= others && others > 0){
      return {ended:true, winner:'دراكولا واتباعه', reason:'فوز دراكولا واتباعه - أصبحوا الأكثرية! 🧛'};
    }
  }
  
  if(mafia.length===0){
    if(alive.length===0) return {ended:true, winner:'لا أحد', reason:'انقرض الجميع في نفس الليلة 💀'};
    return {ended:true, winner:'المدنيون', reason:'انقراض المافيا'};
  }
  if(mafia.length >= alive.length-mafia.length) return {ended:true, winner:'المافيا', reason:'سيطرة المافيا'};
  return {ended:false};
}

// ---------- BOT ----------
let api = null;
let BOT_ID = null;
const PLAYER_ROOMS = {};      // userID -> roomID (their private room from ROOM_IDS)
const ROOM_LOCAL_COUNTS = {}; // roomID -> number of players locally assigned (not yet reflected by API)
const PENDING_ROOM_RESOLVE = {}; // userID -> Promise (in-flight resolvePlayerRoom calls)

// ---------- ANTI-BAN: Rate Limiter للذكاء الاصطناعي ----------
// منع أكثر من طلب واحد كل 4 ثوانٍ لنفس المستخدم
const _aiRateLimit = new Map(); // userID -> timestamp آخر طلب
const AI_RATE_MS = 4000; // 4 ثوانٍ بين كل طلب للمستخدم الواحد

function _checkAIRate(userID){
  const now = Date.now();
  const last = _aiRateLimit.get(userID) || 0;
  if(now - last < AI_RATE_MS) return false;
  _aiRateLimit.set(userID, now);
  return true;
}

// تأخير عشوائي يشبه الكتابة البشرية
function _humanDelay(){ return Math.floor(Math.random() * 3000) + 2000; } // 2-5 ثوانٍ

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function kickPlayers(players){
  let delay = 5000;
  for(const p of players){
    const roomID = PLAYER_ROOMS[p.userID];
    if(!roomID) continue;
    // Clear cache immediately so next game re-discovers the correct room
    delete PLAYER_ROOMS[p.userID];
    delete PENDING_ROOM_RESOLVE[p.userID];
    // Fix #1: decrement local room counter immediately to keep counts accurate
    ROOM_LOCAL_COUNTS[roomID] = Math.max(0, (ROOM_LOCAL_COUNTS[roomID] || 1) - 1);
    const nameSnapshot = p.name;
    const uid = p.userID;
    setTimeout(()=>{
      // Skip if player joined a new active game before the kick timer fired
      const inNewGame = Object.values(GAMES).some(g =>
        g.phase !== 'ended' && g.players.some(gp => gp.userID === uid)
      );
      if(inNewGame){ console.log('Skipped kick for', uid, '— rejoined a new game'); return; }
      api.removeUserFromGroup(uid, roomID, (err)=>{
        if(err) console.error('removeUserFromGroup failed for', uid, JSON.stringify(err));
        else console.log('Kicked', nameSnapshot, 'from room', roomID);
      });
    }, delay);
    delay += 4000;
  }
}

// ---------- CONNECTION WATCHDOG ----------
let consecutiveSendFailures = 0;
const MAX_SEND_FAILURES = 15;

function onSendSuccess(){ consecutiveSendFailures = 0; }
function onSendFailure(ctx){
  consecutiveSendFailures++;
  console.error('send error', ctx, '| consecutive failures:', consecutiveSendFailures);
  if(consecutiveSendFailures >= MAX_SEND_FAILURES){
    console.error('Too many consecutive send failures — restarting process to reconnect...');
    process.exit(1);
  }
}

// Retry a single sendMessage call up to `tries` times with backoff
function sendMessageWithRetry(payload, threadID, tries=3, baseDelay=2500){
  return new Promise((resolve)=>{
    if(!api){ resolve(false); return; }
    let attempt = 0;
    function tryOnce(){
      attempt++;
      api.sendMessage(payload, threadID, (e)=>{
        if(!e){ onSendSuccess(); resolve(true); return; }
        const errStr = JSON.stringify(e);
        console.warn(`[send] attempt ${attempt}/${tries} failed for ${threadID}: ${errStr}`);
        if(attempt >= tries){
          onSendFailure(threadID + ': ' + errStr);
          resolve(false);
        } else {
          setTimeout(tryOnce, baseDelay * attempt);
        }
      });
    }
    tryOnce();
  });
}

function send(threadID, text){
  sendMessageWithRetry({body:text}, threadID);
}

function sendAsync(threadID, payload){
  const msg = typeof payload === 'string' ? {body: payload} : payload;
  return sendMessageWithRetry(msg, threadID);
}

async function sendWait(threadID, text, waitMs=3000){
  await sendAsync(threadID, text);
  await sleep(waitMs);
}

// Serialize room resolutions — only one at a time to avoid Facebook rate limits
let _roomResolveLock = Promise.resolve();

// getThreadInfo with up to `retries` retries on failure
function getThreadInfoRetry(roomID, retries=3, delayMs=1500){
  return new Promise((resolve)=>{
    function attempt(left){
      api.getThreadInfo(roomID, (e, info)=>{
        if(!e && info && info.participantIDs) return resolve(info);
        if(left <= 1){ resolve(null); return; }
        setTimeout(()=>attempt(left-1), delayMs);
      });
    }
    attempt(retries);
  });
}

function resolvePlayerRoom(userID){
  if(PLAYER_ROOMS[userID]) return Promise.resolve(PLAYER_ROOMS[userID]);
  if(PENDING_ROOM_RESOLVE[userID]) return PENDING_ROOM_RESOLVE[userID];
  if(ROOM_IDS.length === 0) return Promise.resolve(null);

  // Queue behind any in-flight resolution + 600ms gap to reduce API pressure
  const promise = _roomResolveLock.then(async ()=>{
    // Re-check cache — another resolution may have run while we waited
    if(PLAYER_ROOMS[userID]){ delete PENDING_ROOM_RESOLVE[userID]; return PLAYER_ROOMS[userID]; }

    // Fetch all rooms sequentially (safer than parallel under rate limits)
    const infos = [];
    for(const roomID of ROOM_IDS){
      const info = await getThreadInfoRetry(roomID);
      if(info) infos.push({ roomID, participants: info.participantIDs });
    }

    // Already in a room? — Re-add to confirm membership (API cache may be stale after recent kick)
    const existing = infos.find(r => r.participants.includes(userID));
    if(existing){
      console.log('Found existing room for', userID, '->', existing.roomID, '— re-adding to confirm');
      await new Promise((res)=>{
        api.addUserToGroup(userID, existing.roomID, (err)=>{
          if(err) console.log('Re-add (confirm) for', userID, ':', err?.error || err);
          else console.log('Re-add confirmed', userID, 'in', existing.roomID);
          res();
        });
      });
      PLAYER_ROOMS[userID] = existing.roomID;
      delete PENDING_ROOM_RESOLVE[userID];
      return existing.roomID;
    }

    if(infos.length === 0){
      console.log('No room info available for', userID);
      delete PENDING_ROOM_RESOLVE[userID];
      return null;
    }

    // Pick emptiest room
    infos.sort((a,b)=>{
      const aT = a.participants.length + (ROOM_LOCAL_COUNTS[a.roomID]||0);
      const bT = b.participants.length + (ROOM_LOCAL_COUNTS[b.roomID]||0);
      return aT - bT;
    });
    const target = infos[0].roomID;
    ROOM_LOCAL_COUNTS[target] = (ROOM_LOCAL_COUNTS[target]||0) + 1;
    console.log('Adding', userID, 'to room', target);

    const added = await new Promise((res)=>{
      api.addUserToGroup(userID, target, (err)=>{
        if(err){
          console.error('addUserToGroup failed', userID, JSON.stringify(err));
          ROOM_LOCAL_COUNTS[target] = Math.max(0,(ROOM_LOCAL_COUNTS[target]||1)-1);
          res(null);
        } else {
          PLAYER_ROOMS[userID] = target;
          console.log('Added', userID, 'to room', target);
          res(target);
        }
      });
    });
    delete PENDING_ROOM_RESOLVE[userID];
    return added;
  });

  // Hold the lock + 600ms gap before the next resolution starts
  _roomResolveLock = promise.catch(()=>{}).then(()=> new Promise(r=>setTimeout(r,600)));
  PENDING_ROOM_RESOLVE[userID] = promise;
  return promise;
}

async function dm(userID, text){
  if(!api) return;
  const roomID = await resolvePlayerRoom(userID);
  const target = roomID || userID;
  console.log('Sending to', userID, 'via', target);
  const ok = await sendMessageWithRetry({body:text}, target, 3, 2000);
  if(!ok) console.warn(`[dm] failed after retries for user ${userID}`);
  await sleep(800);
}


// ---------- ANTI-SPAM ----------
const spamMap = {}; // userID -> { count, lastReset, warned }
const SPAM_LIMIT   = 4;   // max messages per window
const SPAM_WINDOW  = 5000; // 5 seconds window
const SPAM_MUTE    = 30000; // mute duration 30 seconds

function isSpam(userID){
  const now = Date.now();
  if(!spamMap[userID]) spamMap[userID] = { count:0, lastReset: now, mutedUntil:0 };
  const s = spamMap[userID];

  // still muted
  if(s.mutedUntil > now) return true;

  // reset window
  if(now - s.lastReset > SPAM_WINDOW){ s.count=0; s.lastReset=now; }

  s.count++;
  if(s.count >= SPAM_LIMIT){
    s.mutedUntil = now + SPAM_MUTE;
    s.count = 0;
    return 'warn'; // first time hit the limit — warn then mute
  }
  return false;
}

login(CREDENTIALS, (err, a)=>{
  if(err) return console.error('login failed', err);
  api = a;
  api.setOptions({ listenEvents: true });
  BOT_ID = api.getCurrentUserID ? String(api.getCurrentUserID()) : null;
  console.log('Bot ready');

  // Save refreshed appstate every 2 minutes to keep session alive
  function saveAppState(){
    try{
      const updated = api.getAppState();
      fs.writeFileSync(APPSTATE_FILE, JSON.stringify(updated, null, 2));
      console.log('[appstate] saved');
    }catch(e){ console.error('[appstate] save error', e); }
  }
  saveAppState();
  setInterval(saveAppState, 2 * 60 * 1000);

  // Real Facebook API ping every 10 minutes — refreshes cookies on Facebook's side
  setInterval(()=>{
    try{
      api.getUserInfo(BOT_ID, (err, data)=>{
        if(!err) console.log('[session] keep-alive ping OK');
        else      console.warn('[session] keep-alive ping failed:', err.error || err.message || err);
      });
    }catch(_){}
  }, 10 * 60 * 1000);

  // ---- STARTUP CLEANUP — kick leftover players from previous session ----
  async function cleanupRoomsOnBoot(){
    if(ROOM_IDS.length === 0) return;
    await sleep(4000); // wait for MQTT to connect
    console.log('[startup] clearing leftover players from rooms...');
    const botID = api.getCurrentUserID ? String(api.getCurrentUserID()) : null;
    for(const roomID of ROOM_IDS){
      const info = await getThreadInfoRetry(roomID);
      if(!info || !info.participantIDs) continue;
      const members = info.participantIDs.filter(id => id !== botID);
      if(members.length === 0){ console.log(`[startup] room ${roomID} already empty`); continue; }
      console.log(`[startup] removing ${members.length} leftover players from ${roomID}`);
      for(const uid of members){
        delete PLAYER_ROOMS[uid];
        await new Promise(res => { api.removeUserFromGroup(uid, roomID, (err)=>{
          if(err) console.error('[startup] kick failed', uid, JSON.stringify(err));
          else    console.log('[startup] kicked', uid, 'from', roomID);
          res();
        }); });
        await sleep(3000);
      }
    }
    console.log('[startup] room cleanup done');
  }
  cleanupRoomsOnBoot();

  // ---- START GAME ----
  function startGameInThread(threadID){
    if(ROOM_IDS.length === 0){ send(threadID, '⚠️ لا توجد غرف خاصة مضافة — أضف غرفة أولاً باستخدام "أضف غرفة [ID]".'); return; }
    const existing = Object.values(GAMES).find(g=>g.threadMainID===threadID && g.phase!=='ended');
    if(existing){ return; }

    const id = 'g_' + Math.random().toString(36).slice(2,10);
    const game = {
      id, threadMainID: threadID,
      players: [], phase: 'joining', round: 0,
      actionQueue: {}, voteTally: {}, log: [], timers: {}, loverLinks: {},
      joinReactions: {}
    };
    GAMES[id] = game;

    // send image first — save its messageID so only reactions TO IT count
    const introImg = path.join(__dirname, 'reaction_image.jpg');
    api.sendMessage(
      { body: STR.join, attachment: fs.createReadStream(introImg) },
      threadID,
      (e, info) => {
        if(e){ console.error('send intro error', e); return; }
        game.joinMsgID = info?.messageID || null;
        saveGame(game);
      }
    );

    const totalSec = DEFAULTS.joinWindowMs / 1000;
    // countdown message after image
    setTimeout(()=> send(threadID, `90s_`), 1500);

    // reminder at 60s remaining
    if(DEFAULTS.joinWindowMs > 65000){
      game.timers.remind60 = setTimeout(()=>{
        if(GAMES[id] && GAMES[id].phase==='joining')
          send(threadID, `60s_`);
      }, DEFAULTS.joinWindowMs - 60000);
    }

    // reminder at 30s remaining
    if(DEFAULTS.joinWindowMs > 35000){
      game.timers.remind30 = setTimeout(()=>{
        if(GAMES[id] && GAMES[id].phase==='joining')
          send(threadID, `30s_`);
      }, DEFAULTS.joinWindowMs - 30000);
    }

    game.timers.join = setTimeout(()=>finalizeJoining(id), DEFAULTS.joinWindowMs);
    saveGame(game);
  }

  // ---- FINALIZE JOINING ----
  async function finalizeJoining(gameId){
    const game = GAMES[gameId]; if(!game) return;
    const botID = api.getCurrentUserID ? String(api.getCurrentUserID()) : null;
    const reactorIDs = Object.keys(game.joinReactions).filter(id => id !== botID);
    console.log('finalizeJoining - reactions:', reactorIDs.length, reactorIDs);

    if(reactorIDs.length < 3){
      send(game.threadMainID, `لازم 3 لاعبين على الاقل`);
      delete GAMES[gameId]; return;
    }

    // Mark as adding so no new reactions are accepted
    game.phase = 'adding';

    // Batch fetch all names at once
    const nameMap = await new Promise(resolve => {
      api.getUserInfo(reactorIDs, (e, info) => {
        const map = {};
        for(const uid of reactorIDs){
          map[uid] = (!e && info && info[uid]) ? info[uid].name : ('لاعب_' + uid.slice(-4));
        }
        resolve(map);
      });
    });

    // Clear any stale room cache for joining players — force fresh room discovery
    for(const uid of reactorIDs){
      delete PLAYER_ROOMS[uid];
      delete PENDING_ROOM_RESOLVE[uid];
    }

    // Add each reactor to a private room sequentially
    for(const uid of reactorIDs){
      if(!GAMES[gameId]) return; // game was cancelled mid-loop
      const name = nameMap[uid] || ('لاعب_' + uid.slice(-4));
      const roomID = await resolvePlayerRoom(uid);
      if(!GAMES[gameId]) return;
      if(!roomID){
        send(game.threadMainID, `⛔ ${name} لم يُضَف — يجب إضافة البوت كصديق أولاً.`);
        continue;
      }
      game.players.push({ userID: uid, name, role: null, alive: true, vote: null });
    }

    if(game.players.length < 3){
      send(game.threadMainID, `❌ لم يكتمل العدد بعد الإضافة. الحد الأدنى 3.`);
      kickPlayers(game.players);
      delete GAMES[gameId]; return;
    }

    game.phase = 'night'; game.round = 1;
    assignRoles(game.players);
    for(const p of game.players){ p.alive = true; p.vote = null; }

    // Send start image AFTER all players are added
    await new Promise(resolve => {
      const imgPath = path.join(__dirname, 'بداية_1774703009787.png');
      api.sendMessage(
        { body: `حلّ الليل… ولا أحد في أمان\nخطأ واحد… قد يكون الأخير`, attachment: fs.createReadStream(imgPath) },
        game.threadMainID,
        (e) => { if(e) console.error('img send error:', JSON.stringify(e)); resolve(); }
      );
    });

    // Send role DMs sequentially
    for(const p of game.players){
      try {
        console.log('Sending role to', p.name, p.userID, 'role:', p.role);
        let roleMsg = STR.roleDM(p.name, p.role, ROLE_DESCS[p.role]||'');
        if(p.role === 'مافيا'){
          const partner = game.players.find(x => x.userID !== p.userID && x.role === 'مافيا');
          if(partner) roleMsg += `\n\n😈 شريكك في المافيا: ${partner.name}\nكل واحد منكم يقتل هدفه بشكل مستقل — إن اتحدتم على نفس الشخص مات واحد فقط.`;
        }
        await dm(p.userID, roleMsg);
      } catch(err){
        console.error(`[startGame] failed to DM role to ${p.name} (${p.userID}):`, err);
      }
    }

    saveGame(game);
    await sleep(2000);
    startNight(gameId);
  }

  // ---- NIGHT ----
  // Returns UIDs of alive players expected to submit a night action
  function nightActorsExpected(game){
    const expected = [];
    for(const p of game.players){
      if(!p.alive) continue;
      if(p.role === 'مواطن' || p.role === 'مهرج' || p.role === 'عالم مجنون') continue;
      if(p.role === 'قناص' && game.sniperUsed) continue;
      if(p.role === 'خطابة'){
        if(game.round !== 1 || Object.keys(game.loverLinks || {}).length > 0) continue;
      }
      expected.push(p.userID);
    }
    return expected;
  }

  // Trigger early night resolution (8s grace) if all active roles submitted
  function checkEarlyNight(gameId){
    const game = GAMES[gameId]; if(!game || game.phase !== 'night') return;
    if(game._earlyNightTriggered) return;
    const expected = nightActorsExpected(game);
    if(expected.length === 0) return;
    const allDone = expected.every(uid => {
      const p = game.players.find(p => p.userID === uid);
      if(!p || !p.alive) return true;
      if(p.role === 'خطابة') return Object.keys(game.loverLinks || {}).length > 0;
      return !!game.actionQueue[uid];
    });
    if(!allDone) return;
    game._earlyNightTriggered = true;
    clearTimeout(game.timers.night);
    console.log('[night] all actions submitted — resolving early in 8s');
    game.timers.night = setTimeout(game._doNightResolution, 8000);
  }

  async function startNight(gameId){
    const game = GAMES[gameId]; if(!game) return;
    game.phase='night'; game.actionQueue={};
    game._earlyNightTriggered = false;
    game._doNightResolution = null;
    saveGame(game);
    const alive = game.players.filter(p=>p.alive);

    // send night prompt via DM to each alive player — await each to ensure delivery order
    const noNightRoles = ['مواطن', 'مهرج'];
    for(const p of alive){
      try {
        if(noNightRoles.includes(p.role)) continue;
        if(p.role === 'قناص'){
          if(!game.sniperUsed){
            const shootList = listText(alive.filter(x => x.userID !== p.userID));
            await dm(p.userID, STR.sniperNightPrompt(game.round, shootList));
          }
          continue;
        }
        if(p.role === 'خطابة'){
          if(game.round === 1 && Object.keys(game.loverLinks || {}).length === 0){
            const others = alive.filter(x => x.userID !== p.userID);
            await dm(p.userID, STR.loverPrompt(listText(others)));
          }
          continue;
        }
        if(p.role === 'عالم مجنون'){
          const killUsed  = game.madScientistKillUsed  || false;
          const reviveUsed= game.madScientistReviveUsed|| false;
          if(killUsed && reviveUsed){ continue; } // انتهت الكبسولتان
          let prompt = `🧪 العالم المجنون — الجولة ${game.round}\n━━━━━━━━━━━━━━━━\n`;
          if(!killUsed){
            // المرحلة الأولى: جرعة الموت فقط
            const aliveOthers = alive.filter(x => x.userID !== p.userID);
            prompt += `☠️ جرعة الموت جاهزة — أرسل رقم هدفك:\n${listText(aliveOthers)}\n`;
            prompt += `━━━━━━━━━━━━━━━━`;
          } else {
            // المرحلة الثانية: كبسولة الإحياء (تظهر بعد استخدام جرعة الموت)
            const deadPlayers = game.players.filter(x => !x.alive);
            if(deadPlayers.length > 0){
              prompt += `💉 كبسولة الإحياء متاحة — أرسل رقم من تريد إعادته:\n${listText(deadPlayers)}\n`;
              prompt += `━━━━━━━━━━━━━━━━`;
            } else {
              prompt += `💉 كبسولة الإحياء: لا أموات حالياً ✖\n━━━━━━━━━━━━━━━━`;
            }
          }
          await dm(p.userID, prompt);
          continue;
        }
        const mafiaPartner = p.role === 'مافيا'
          ? game.players.find(x => x.userID !== p.userID && x.role === 'مافيا')
          : null;
        const personalList = listText(alive.filter(x =>
          x.userID !== p.userID && (!mafiaPartner || x.userID !== mafiaPartner.userID)
        ));
        if(p.role === 'SCP-096'){
          await dm(p.userID, STR.scpNightPrompt(game.round, personalList));
        } else if(p.role === 'نهاب'){
          await dm(p.userID, STR.nahabPrompt(game.round, personalList));
        } else if(p.role === 'دراكولا'){
          await dm(p.userID, STR.draculaPrompt(game.round, personalList));
        } else {
          await dm(p.userID, STR.nightPrompt(game.round, p.role, personalList));
        }
      } catch(err){
        console.error(`[startNight] failed to DM ${p.name} (${p.userID}):`, err);
      }
    }

    async function doNightResolution(){
      try {
      const g = GAMES[gameId]; if(!g || g.phase !== 'night') return;
      if(!g.scpKillCount) g.scpKillCount = 0;
      const { deaths, doctorSavedTarget } = await resolveNight(g);
      // Send النهاب their stolen role privately
      if(g._nahabResults && g._nahabResults.length > 0){
        for(const r of g._nahabResults){
          if(r.targetDied){
            await dm(r.nahabID,
              `━━━━━━━━━━━━━━━━\n🦹 سرقة ناجحة — هدف ميت\n━━━━━━━━━━━━━━━━\n` +
              `${r.targetName} لقي حتفه الليلة، لكن سرقتك سبقت موته!\n` +
              `دورك الجديد: 『 ${r.stolenRole} 』`
            );
          } else {
            await dm(r.nahabID, STR.nahabStole(r.targetName, r.stolenRole));
          }
        }
        g._nahabResults = [];
      }
      // Send القناص their shot result privately
      for(const d of deaths){
        if(d.bySniper && d.sniperID){
          if(d.wasted){
            await dm(d.sniperID, `🎯 هدفك (${d.name}) كان قد لقي حتفه قبل رصاصتك — الرصاصة ضاعت.`);
          } else {
            await dm(d.sniperID, STR.sniperResult(d.name, d.role === 'مافيا'));
          }
        }
      }
      const realDeaths = deaths.filter(d => !d.wasted);
      if(realDeaths.length===0){
        if(doctorSavedTarget){
          await sendWait(g.threadMainID, STR.doctorSaved(), 3000);
        } else {
          await sendWait(g.threadMainID, STR.noDeaths, 3000);
        }
      } else {
        for(const d of deaths){
          let msg;
          if(d.byLover)    msg = withMentions(STR.loverDeath(d.name, d.partnerName), [d.name, d.userID], [d.partnerName, d.partnerID]);
          else if(d.byScp) {
            g.scpKillCount++;
            msg = withMentions(STR.scpKill(d.name, g.scpKillCount), [d.name, d.userID]);
          }
          else if(d.bySniper && !d.wasted) msg = withMentions(STR.sniperResult(d.name, d.role === 'مافيا'), [d.name, d.userID]);
          else if(d.bySniper && d.wasted) continue;
          else if(d.byMafia) msg = withMentions(STR.mafiaDeath(d.name, d.role), [d.name, d.userID]);
          if(msg) await sendWait(g.threadMainID, msg, 3000);
        }
      }
      g.log.push({round:g.round, deaths});
      saveGame(g);
      const win = checkWin(g);
      if(win.ended){ await endGame(g,win); return; }
      startDay(gameId);
      } catch(err){
        console.error('[doNightResolution] uncaught error:', err);
        const g = GAMES[gameId];
        if(g) send(g.threadMainID, '⚠️ حدث خطأ غير متوقع في حل الليل، يتم الانتقال للنهار...');
        try { startDay(gameId); } catch(e2){ console.error('[doNightResolution] startDay fallback failed:', e2); }
      }
    }
    game.timers.night = setTimeout(doNightResolution, DEFAULTS.nightWindowMs);
    game._doNightResolution = doNightResolution;
  }

  // ---- DAY ----
  // Checks if all eligible voters have voted → early resolution (8s grace)
  function checkEarlyDay(gameId){
    const game = GAMES[gameId]; if(!game || game.phase !== 'day') return;
    if(game._earlyDayTriggered) return;
    const eligibleVoters = game.players.filter(p =>
      p.alive && !(game.blockedVoters || []).includes(p.userID)
    );
    if(eligibleVoters.length === 0) return;
    const allVoted = eligibleVoters.every(p => p._voted);
    if(!allVoted) return;
    game._earlyDayTriggered = true;
    clearTimeout(game.timers.day);
    console.log('[day] all eligible voters voted — resolving early in 8s');
    game.timers.day = setTimeout(game._doDayResolution, 8000);
  }

  async function startDay(gameId){
    const game = GAMES[gameId]; if(!game) return;
    game.phase='day'; game._earlyDayTriggered = false; game._doDayResolution = null;
    saveGame(game);
    for(const p of game.players){ p.vote=null; p._voted=false; }
    if(!game.blockedVoters) game.blockedVoters = [];
    const alive = game.players.filter(p=>p.alive);

    // send vote DMs to players FIRST, then announce in main room
    for(const p of alive){
      try {
        if((game.blockedVoters || []).includes(p.userID)){
          await dm(p.userID, `⛓️ الجلاد قيّدك — صوتك مُصادَر هذا اليوم. لا يمكنك التصويت.`);
        } else {
          const voteList = listText(alive.filter(x => x.userID !== p.userID));
          await dm(p.userID, STR.dayPrompt(game.round, voteList));
        }
      } catch(err){
        console.error(`[startDay] failed to DM ${p.name} (${p.userID}):`, err);
      }
    }
    await sendWait(game.threadMainID, `وقت التصويت 🗣️  صوت بعقلك واترك الشخصنة`, 3000);

    async function doDayResolution(){
      try {
      if(!GAMES[game.id] || game.phase !== 'day') return;
      game.voteTally={};
      for(const p of game.players){
        // Fix #1: only count votes from alive players
        if(p.alive && p.vote && game.players.find(x=>x.userID===p.vote&&x.alive)){
          game.voteTally[p.vote]=(game.voteTally[p.vote]||0)+1;
        }
      }

      let max=-1; let cands=[];
      for(const [uid,sc] of Object.entries(game.voteTally)){
        if(sc>max){max=sc;cands=[uid];}else if(sc===max) cands.push(uid);
      }

      // ---- إحصائية التصويت (فقط إذا كان هناك صوتان أو أكثر) ----
      if(max >= 2){
        const allAlive = game.players.filter(p=>p.alive);
        const voted = allAlive.filter(p=>(game.voteTally[p.userID]||0) > 0);
        let statsBody = `📊 إحصائية التصويت:\n━━━━━━━━━━━━━━━━\n`;
        const statsMentions = [];
        for (const p of voted) {
          const prefix = `${game.voteTally[p.userID]} — `;
          statsMentions.push({ tag: p.name, id: p.userID, fromIndex: statsBody.length + prefix.length });
          statsBody += `${prefix}${p.name}\n`;
        }
        statsBody += `━━━━━━━━━━━━━━━━`;
        await sendWait(game.threadMainID, { body: statsBody, mentions: statsMentions }, 3000);
      }

      // صوت واحد غير كافٍ للإعدام
      if(max < 2){
        await sendWait(game.threadMainID, `⚖️ الأصوات غير كافية لتنفيذ الإعدام.\n🕊️ لا أحد يُشنق اليوم — المافيا تبتسم في الظل.`, 3000);
      } else if(cands.length===1){
        const ex=game.players.find(p=>p.userID===cands[0]);
        if(ex){
          ex.alive=false;
          // Jester wins if executed by vote
          if(ex.role === 'مهرج'){
            await sendWait(game.threadMainID, withMentions(STR.voteResultJester(ex.name), [ex.name, ex.userID]), 3000);
            saveGame(game);
            await endGame(game, {ended:true, winner:ex.name+' (المهرج)', reason:'أُعدم المهرج بالتصويت وفاز!'});
            return;
          }
          const msg = ex.role==='مافيا'
            ? withMentions(STR.voteResultMafia(ex.name), [ex.name, ex.userID])
            : withMentions(STR.voteResultCiv(ex.name, ex.role), [ex.name, ex.userID]);
          await sendWait(game.threadMainID, msg, 3000);
          // lover cascade
          const loverVote = triggerLoverDeath(game, ex);
          if(loverVote){
            await sendWait(game.threadMainID, withMentions(STR.loverDeath(loverVote.name, ex.name), [loverVote.name, loverVote.userID], [ex.name, ex.userID]), 3000);
          }
        }
      } else {
        await sendWait(game.threadMainID, STR.tie, 3000);
      }
      saveGame(game);
      const win=checkWin(game);
      if(win.ended){ await endGame(game,win); return; }
      // non-ending round: show alive/dead status then start next night
      await sendWait(game.threadMainID, aliveDeadText(game), 3000);
      game.round+=1; saveGame(game);
      startNight(game.id);
      } catch(err){
        console.error('[dayResolution] uncaught error:', err);
        send(game.threadMainID, '⚠️ حدث خطأ في حل التصويت، يتم الانتقال للجولة التالية...');
        try { game.round+=1; startNight(game.id); } catch(e2){ console.error('[dayResolution] startNight fallback failed:', e2); }
      }
    }
    game.timers.day = setTimeout(doDayResolution, DEFAULTS.dayWindowMs);
    game._doDayResolution = doDayResolution;
  }

  // ---- END GAME ----
  const ROLE_EMOJIS = {
    'مافيا':'😈','محقق':'🕵️','طبيب':'👨‍⚕️','قناص':'🎯',
    'مهرج':'🃏','جلاد':'⛓️','خطابة':'🧚','مواطن':'👤',
    'SCP-096':'☣️','نهاب':'🦹','دراكولا':'🧛','مصاص دماء':'🧛','عالم مجنون':'🧪'
  };

  async function endGame(game, win){
    game.phase='ended';
    clearTimeout(game.timers.join);
    clearTimeout(game.timers.night);
    clearTimeout(game.timers.day);

    // Build best players ranking: alive first, then by round of death (latest = better)
    const playerRounds = {};
    for (const roundLog of (game.log || [])) {
      for (const d of (roundLog.deaths || [])) {
        if (d.userID && !d.wasted) playerRounds[d.userID] = roundLog.round;
      }
    }
    const ranked = [...game.players].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return (playerRounds[b.userID] || 0) - (playerRounds[a.userID] || 0);
    });

    // Build game over message with mentions
    const medals = ['🥇', '🥈', '🥉'];
    let goBody = `فاز ${win.winner} — ${win.reason} 🏆‼️\n\n`;
    const goMentions = [];
    for (const p of game.players) {
      const em = ROLE_EMOJIS[p.role] || '';
      const status = p.alive ? '🙂حي' : '💀ميت';
      goMentions.push({ tag: p.name, id: p.userID, fromIndex: goBody.length });
      goBody += `${p.name} :${p.role}${em}—${status}\n`;
    }
    goBody += '\n📊افضل اللاعبين\n';
    for (let i = 0; i < Math.min(3, ranked.length); i++) {
      const p = ranked[i];
      const em = ROLE_EMOJIS[p.role] || '';
      goBody += '-';
      goMentions.push({ tag: p.name, id: p.userID, fromIndex: goBody.length });
      goBody += `${p.name} :${p.role}${em} ${medals[i]}\n`;
    }

    // Winner announcement
    await sendAsync(game.threadMainID, { body: goBody.trimEnd(), mentions: goMentions });

    kickPlayers(game.players);
    // Delete game file — no need to keep ended games on disk
    try{ fs.unlinkSync(path.join(GAMES_DIR, `${game.id}.json`)); } catch(_){}
    delete GAMES[game.id];
  }

  // ---- EVENTS ----
  let isReconnecting = false;
  function startListening(){
    isReconnecting = false;
    api.listenMqtt(async (err, event)=>{
      if(err){
        console.error('mqtt error', err);
        if(err.error === 'login_blocked' || err.type === 'account_inactive'){
          console.log('Session blocked — update appstate.json and restart the bot');
          return;
        }
        if(!isReconnecting){
          isReconnecting = true;
          console.log('Reconnecting in 5s...');
          setTimeout(startListening, 5000);
        }
        return;
      }
    try{

      // REACTION → join (only on the intro image message)
      if(event.type==='message_reaction' && event.userID){
        // Ignore bot's own reactions
        const _botID = api.getCurrentUserID ? String(api.getCurrentUserID()) : null;
        if(_botID && event.userID === _botID) return;
        const game = Object.values(GAMES).find(g=>g.phase==='joining' && g.threadMainID===event.threadID);
        if(!game) return;
        // Wait until joinMsgID is known — don't accept reactions to unknown messages
        if(!game.joinMsgID) return;
        // ignore reactions to any message other than the intro image
        if(event.messageID && event.messageID !== game.joinMsgID) return;

        // Fix #6: handle unreact — player removes their reaction = leave game
        if(event.reaction === '' || event.reaction === null || event.reaction === undefined){
          // Cancel in-flight join (player reacted then unreacted before room was assigned)
          if(game.pendingJoins?.has(event.userID)){
            game.pendingJoins.delete(event.userID);
            return;
          }
          const idx = game.players.findIndex(p=>p.userID===event.userID);
          if(idx !== -1){
            const removed = game.players.splice(idx, 1)[0];
            kickPlayers([removed]);
            send(game.threadMainID, `🚪 ${removed.name} سحب تفاعله وغادر اللعبة.`);
            saveGame(game);
          }
          return;
        }

        // Just record the reaction — all joining happens at finalizeJoining time
        game.joinReactions[event.userID] = true;
        saveGame(game);
      }

      // كاشف ستكرات — يطبع الـ ID لما أحد يرسل ستكر
      if((event.type==='message' || event.type==='message_reply') && event.attachments && event.attachments.length){
        for(const att of event.attachments){
          if(att.type === 'sticker'){
            console.log(`[STICKER_DETECT] stickerID=${att.stickerID || att.ID || att.id} pack=${att.packID} url=${att.url}`);
          }
        }
      }

      // MESSAGE → commands & player actions
      if((event.type==='message' || event.type==='message_reply') && event.senderID && event.body){
        const sender = event.senderID;

        // تجاهل رسائل البوت نفسه لتفادي اللوبات
        if(BOT_ID && String(sender) === String(BOT_ID)) return;

        const text   = (event.body||'').trim();

        // ── هل هناك لعبة نشطة في هذه الغرفة؟ (الغرفة الرئيسية) ──
        const _gameInThisThread = Object.values(GAMES).find(g => g.threadMainID === event.threadID);

        // --- علياء ستكر ---
        if(text === 'علياء'){
          if(_gameInThisThread) return;
          console.log('[STICKER] sending علياء sticker to', event.threadID);
          api.sendMessage({ sticker: 2000298047141492 }, event.threadID, (err) => {
            if(err) console.error('[STICKER] error:', JSON.stringify(err));
            else console.log('[STICKER] sent ok');
          }, event.messageID);
          return;
        }

        // --- IMAGE GENERATION ---
        if(text.startsWith('صورة ') || text.startsWith('رسم ') || text.startsWith('انمي ')){
          if(_gameInThisThread) return;
          let prompt, styleSuffix = '';
          if(text.startsWith('انمي ')){
            prompt = text.slice('انمي '.length).trim();
            styleSuffix = 'anime';
          } else {
            const prefix = text.startsWith('صورة ') ? 'صورة ' : 'رسم ';
            prompt = text.slice(prefix.length).trim();
          }
          if(!prompt){
            api.sendMessage('قولي وش أرسم لك 🎨', event.threadID);
          } else {
            const msgID = event.messageID;
            const tID   = event.threadID;
            api.setMessageReaction('⏳', msgID, tID, ()=>{}, true);
            aiModule.generateImage(prompt, styleSuffix)
              .then(stream => {
                api.sendMessage({ attachment: stream }, tID, (err)=>{
                  if(err){
                    console.error('[IMG] send error:', err);
                    api.setMessageReaction('😞', msgID, tID, ()=>{}, true);
                  } else {
                    api.setMessageReaction('💗', msgID, tID, ()=>{}, true);
                  }
                });
              })
              .catch(err => {
                console.error('[IMG] generate error:', err.message || err);
                api.setMessageReaction('😞', msgID, tID, ()=>{}, true);
              });
          }
          return;
        }

        // --- AI COMMAND (before spam filter so it always works) ---
        {
          const _isAICmd = text.startsWith('ذكاء ') || text === 'مسح ذكاء';
          const _isNiroCall = /^نيرو[\s,،!؟?]/i.test(text) || text.toLowerCase() === 'نيرو';
          // Reply detection: only trigger if replying to a specific نيرو AI message
          const _repliedMsgID = event.messageReply && event.messageReply.messageID;
          const _isReplyToBotMsg = !!(BOT_ID && _repliedMsgID && aiModule.isBotMessage(_repliedMsgID, String(sender)));
          if((_isAICmd || _isNiroCall || _isReplyToBotMsg) && !_gameInThisThread){
            const replyTo = event.messageID || null;
            const sendReply = (msg) => {
              if(!api) return;
              api.sendMessage({ body: msg }, event.threadID, (err, info)=>{
                if(err){ onSendFailure(event.threadID + ': ' + JSON.stringify(err)); return; }
                onSendSuccess();
                // Store the bot's sent message ID so we can detect replies to it later
                if(info && info.messageID) aiModule.storeBotMessage(String(sender), info.messageID);
              }, replyTo);
            };
            if(text === 'مسح ذكاء'){
              aiModule.clearHistory(String(sender));
              sendReply('تم مسح السجل 🗑️');
              return;
            }

            // ANTI-BAN: تحقق من معدل الطلبات — تجاهل لو المستخدم طلب قبل 4 ثوانٍ
            if(!_checkAIRate(String(sender))) return;

            let question;
            if(text.startsWith('ذكاء ')){
              question = text.slice('ذكاء '.length).trim();
              if(!question){ sendReply('قولي وش تبي أسألني عنه 😄'); return; }
            } else if(_isNiroCall){
              question = text.replace(/^نيرو[\s,،!؟?]*/i, '').trim();
              if(!question){ sendReply('هلا! قولي وش تبي 😄'); return; }
            } else {
              question = text.trim();
              if(!question) return;
            }

            const _aiIsAdmin = ADMINS.map(String).includes(String(sender));

            // ANTI-BAN: إرسال مؤشر الكتابة + تأخير عشوائي قبل الرد
            try{ api.sendTypingIndicator(event.threadID, ()=>{}); } catch(_){}
            sleep(_humanDelay()).then(()=> aiModule.askAI(String(sender), question, { isAdmin: _aiIsAdmin }))
              .then(reply => {
                // ANTI-BAN: إيقاف مؤشر الكتابة قبل الإرسال
                try{ api.sendTypingIndicator(event.threadID, ()=>{}); } catch(_){}
                sendReply(reply);
              })
              .catch(err => {
                console.error('[AI] error:', err.message || err);
                sendReply('صار خطأ ما قدرت أرد 😅 جرب ثاني.');
              });
            return;
          }
        }

        // Fix #5: anti-spam only for non-game messages (group rooms that aren't private game rooms)
        const isPrivateGameRoom = ROOM_IDS.includes(event.threadID);
        const isDirectMsg = event.threadID === sender || !event.isGroup;
        if(!isPrivateGameRoom && !isDirectMsg){
          const spamStatus = isSpam(sender);
          if(spamStatus === 'warn'){
            return;
          }
          if(spamStatus === true) return; // silently ignore while muted
        }

        // --- COMMANDS in any group room ---
        if(event.threadID !== sender){ // group message (not DM)
          const senderStr = String(sender);
          const isAdmin = ADMINS.length === 0 || ADMINS.map(String).includes(senderStr);
          const adminCmds = ['The fool','إلغاء','الغاء','قواعد','idroom','تفريغ','add room','rem room','حذف','حذف غرفة'];
          const isAdminPrefix = ['rem','add','ادمن','شيل ادمن','ادمن بوت','شيل ادمن بوت'].some(p=>text===p||text.startsWith(p+' '));
          if((adminCmds.some(c=>text===c)||isAdminPrefix) && !isAdmin){ return; }

          // ── أثناء اللعبة: تجميد جميع الأوامر ما عدا إلغاء وقواعد ──
          if(_gameInThisThread){
            if(text==='إلغاء' || text==='الغاء'){
              const g = _gameInThisThread;
              clearTimeout(g.timers.join);
              clearTimeout(g.timers.night);
              clearTimeout(g.timers.day);
              clearTimeout(g.timers.remind60);
              clearTimeout(g.timers.remind30);
              kickPlayers(g.players);
              delete GAMES[g.id];
              api.setMessageReaction('😒', event.messageID, event.threadID, ()=>{}, true);
            } else if(text==='The fool'){
            } else if(text==='قواعد'){
              send(event.threadID, buildRules());
            }
            return; // تجميد كل شيء آخر
          }

          if(text==='فرح'){ api.sendMessage({ sticker: 8298100756942308 }, event.threadID, ()=>{}, event.messageID); return; }
          if(text==='رضوتن' || text==='رضوان'){ send(event.threadID, 'احسن واحد 🖤'); return; }

          if(text==='معرف'){ send(event.threadID, `🆔 معرف هذه الغرفة:\n${event.threadID}`); return; }
          if(text==='ابدي'){
            const targetID = event.messageReply ? event.messageReply.senderID : sender;
            api.sendMessage(`🆔 الابدي: ${targetID}`, event.threadID, ()=>{}, event.messageID);
            return;
          }
          // حذف رسالة البوت بالرد عليها
          if(text === 'حذف'){
            const replyMsgID = event.messageReply && event.messageReply.messageID;
            if(!replyMsgID) return;
            api.unsendMessage(replyMsgID, (err) => {
              if(err){ /* تجاهل — رسالة مو تابعة للبوت */ }
            });
            setTimeout(() => api.unsendMessage(event.messageID, ()=>{}), 800);
            return;
          }
          // ادمن بوت — إضافة أدمن للبوت
          if(text === 'ادمن بوت' || text.startsWith('ادمن بوت ')){
            const mentionIDs = Object.keys(event.mentions || {});
            const arg = text.startsWith('ادمن بوت ') ? text.slice('ادمن بوت '.length).trim() : '';
            const replyID = event.messageReply?.senderID ? String(event.messageReply.senderID) : null;
            const targetID = mentionIDs.length > 0 ? mentionIDs[0] : (/^\d+$/.test(arg) ? arg : null) || replyID;
            if(!targetID){
              return;
            } else if(ADMINS.map(String).includes(String(targetID))){
              return;
            } else {
              ADMINS.push(String(targetID));
              saveAdmins();
              send(event.threadID, `✅ تم تعيينه أدمن بوت.\n👥 عدد الأدمنية: ${ADMINS.length}`);
            }
            return;
          }
          // شيل ادمن بوت — إزالة أدمن من البوت
          if(text === 'شيل ادمن بوت' || text.startsWith('شيل ادمن بوت ')){
            const mentionIDs = Object.keys(event.mentions || {});
            const arg = text.startsWith('شيل ادمن بوت ') ? text.slice('شيل ادمن بوت '.length).trim() : '';
            const replyID = event.messageReply?.senderID ? String(event.messageReply.senderID) : null;
            const targetID = mentionIDs.length > 0 ? mentionIDs[0] : (/^\d+$/.test(arg) ? arg : null) || replyID;
            if(!targetID){
              return;
            } else {
              const idx = ADMINS.map(String).indexOf(String(targetID));
              if(idx === -1){
                return;
              } else {
                ADMINS.splice(idx, 1);
                saveAdmins();
                send(event.threadID, `✅ تم إزالته من أدمنية البوت.\n👥 عدد الأدمنية: ${ADMINS.length}`);
              }
            }
            return;
          }
          if(text==='أضف غرفة' || text==='اضف غرفة'){
            const tid = event.threadID;
            if(ROOM_IDS.includes(tid)){
              send(tid, '⚠️ هذه الغرفة مضافة مسبقاً.');
            } else {
              ROOM_IDS.push(tid);
              saveRooms();
              send(tid, `✅ تمت إضافة الغرفة بنجاح!\n🏠 إجمالي الغرف: ${ROOM_IDS.length}`);
            }
            return;
          }
          if(text==='حذف غرفة'){
            const tid = event.threadID;
            const idx = ROOM_IDS.indexOf(tid);
            if(idx === -1){
              send(tid, '⚠️ هذه الغرفة غير موجودة في قائمة الغرف.');
            } else {
              ROOM_IDS.splice(idx, 1);
              saveRooms();
              send(tid, `🗑️ تمت إزالة الغرفة.\n🏠 إجمالي الغرف: ${ROOM_IDS.length}`);
            }
            return;
          }
          // طرد عضو
          if(text === 'rem' || text.startsWith('rem ')){
            const mentionIDs = Object.keys(event.mentions || {});
            const arg = text.startsWith('rem ') ? text.slice('rem '.length).trim() : '';
            const replyID = event.messageReply && event.messageReply.senderID ? String(event.messageReply.senderID) : null;
            const targetID = mentionIDs.length > 0 ? mentionIDs[0]
                           : (/^\d+$/.test(arg) ? arg : null)
                           || replyID;
            if(!targetID){
              api.setMessageReaction('☹️', event.messageID, event.threadID, ()=>{}, true);
            } else {
              api.removeUserFromGroup(targetID, event.threadID, (err)=>{
                if(err) api.setMessageReaction('☹️', event.messageID, event.threadID, ()=>{}, true);
                else     send(event.threadID, `✅ تم طرد العضو بنجاح.`);
              });
            }
            return;
          }
          // إضافة عضو
          if(text === 'add' || text.startsWith('add ')){
            const arg = text.replace(/^(add)\s*/, '').trim();
            const replyID = event.messageReply && event.messageReply.senderID ? String(event.messageReply.senderID) : null;
            const targetID = /^\d+$/.test(arg) ? arg : replyID;
            if(!targetID){
              api.setMessageReaction('☹️', event.messageID, event.threadID, ()=>{}, true);
            } else {
              api.addUserToGroup(targetID, event.threadID, (err)=>{
                if(err) api.setMessageReaction('☹️', event.messageID, event.threadID, ()=>{}, true);
                else     send(event.threadID, `✅ تمت إضافة العضو بنجاح.`);
              });
            }
            return;
          }
          // تعيين/إزالة أدمن
          if(text === 'ادمن' || text.startsWith('ادمن ') || text === 'شيل ادمن' || text.startsWith('شيل ادمن ')){
            const isRevoke = text.startsWith('شيل');
            const base = isRevoke ? 'شيل ادمن' : 'ادمن';
            const arg = text.startsWith(base + ' ') ? text.slice(base.length + 1).trim() : '';
            const mentionIDs = Object.keys(event.mentions || {});
            const replyID = event.messageReply?.senderID ? String(event.messageReply.senderID) : null;
            const targetID = mentionIDs.length > 0 ? mentionIDs[0]
                           : /^\d+$/.test(arg) ? arg
                           : replyID;
            if(!targetID){
              return;
            } else {
              api.changeAdminStatus(event.threadID, targetID, !isRevoke, (err)=>{
                if(err) send(event.threadID, `❌ ما قدرت — تأكد إن البوت أدمن في المجموعة.\n${err.error||''}`);
                else     send(event.threadID, isRevoke ? `✅ تم سحب صلاحية الأدمن.` : `✅ تم تعيين العضو أدمن.`);
              });
            }
            return;
          }
          if(text==='تفريغ'){
            send(event.threadID, '🧹 جاري تفريغ جميع الغرف...');
            let kicked = 0;
            let pending = ROOM_IDS.length;
            for(const roomID of ROOM_IDS){
              api.getThreadInfo(roomID, (e, info)=>{
                if(!e && info && info.participantIDs){
                  const botID = String(api.getCurrentUserID ? api.getCurrentUserID() : '');
                  const members = info.participantIDs.filter(id => id !== botID);
                  let kickDelay = 2000;
                  for(const uid of members){
                    delete PLAYER_ROOMS[uid];
                    delete PENDING_ROOM_RESOLVE[uid];
                    setTimeout(()=>{
                      api.removeUserFromGroup(uid, roomID, (err)=>{
                        if(!err){ kicked++; }
                      });
                    }, kickDelay);
                    kickDelay += 3000;
                  }
                }
                pending--;
                if(pending === 0) setTimeout(()=>send(event.threadID, `✅ تم تفريغ الغرف — تمت إزالة ${kicked} عضو.`), 8000);
              });
            }
            return;
          }
          if(text==='The fool')  { startGameInThread(event.threadID); return; }
          if(text==='إلغاء' || text==='الغاء'){
            const g=Object.values(GAMES).find(x=>x.threadMainID===event.threadID);
            if(g){
              clearTimeout(g.timers.join); clearTimeout(g.timers.night); clearTimeout(g.timers.day);
              kickPlayers(g.players);
              delete GAMES[g.id];
              api.setMessageReaction('😒', event.messageID, event.threadID, ()=>{}, true);
            }
            return;
          }
          if(text==='قواعد'){ send(event.threadID, buildRules()); return; }
        }

        // --- PRIVATE ROOM OR DM → NIGHT ACTION / DAY VOTE ---
        const isPrivateRoom = ROOM_IDS.includes(event.threadID);
        const isDM = event.threadID === sender || !event.isGroup;
        if(isPrivateRoom || isDM){
          for(const gameId of Object.keys(GAMES)){
            const game=GAMES[gameId]; if(!game) continue;
            if(event.threadID === game.threadMainID) continue; // skip main room
            const player=game.players.find(p=>p.userID===sender);
            if(!player) continue;
            if(!player.alive){ continue; }

            // DAY VOTE
            if(game.phase === 'day'){
              const alive=game.players.filter(p=>p.alive && p.userID !== sender);

              // Blocked voter check
              if(game.blockedVoters && game.blockedVoters.includes(sender)){
                api.setMessageReaction('⛓️', event.messageID, event.threadID, ()=>{}, true); continue;
              }

              if(player._voted){ continue; }
              const tid=resolveTarget(text,alive);
              if(!tid){ dm(sender,STR.invalidTarget); continue; }
              const votedName = game.players.find(p=>p.userID===tid)?.name || 'الهدف';
              player.vote=tid; player._voted=true;
              api.setMessageReaction('🗣️', event.messageID, event.threadID, ()=>{}, true);
              saveGame(game);
              checkEarlyDay(game.id);
              continue;
            }

            // NIGHT ACTION
            if(game.phase === 'night'){

              // ---- عالم مجنون — أوامر فورية بالرقم ----
              if(player.role === 'عالم مجنون'){
                const numMatch = text.match(/^\d+$/);
                if(!numMatch){ continue; } // تجاهل أي شيء غير رقم
                const num = parseInt(text);

                // المرحلة الأولى: جرعة الموت
                if(!game.madScientistKillUsed){
                  const aliveTargets = game.players.filter(p=>p.alive && p.userID!==sender);
                  const target = aliveTargets[num - 1];
                  if(!target){ dm(sender, STR.invalidTarget); continue; }
                  game.madScientistKillUsed = true;
                  target.alive = false;
                  dm(sender, `☠️ جرعة الموت وصلت — ${target.name} سقط!`);
                  await sendWait(game.threadMainID,
                    withMentions(`🧪 العالم المجنون حقن جرعة الموت — ${target.name} سقط ميتاً في الظلام!`, [target.name, target.userID]),
                    1500);
                  // lover cascade
                  const lover = triggerLoverDeath(game, target);
                  if(lover){
                    await sendWait(game.threadMainID,
                      withMentions(STR.loverDeath(lover.name, target.name), [lover.name, lover.userID], [target.name, target.userID]),
                      1500);
                  }
                  saveGame(game);
                  const win = checkWin(game);
                  if(win.ended){ await endGame(game, win); return; }
                  // أرسل له الـ prompt للإحياء مباشرة إن وُجد أموات
                  const deadNow = game.players.filter(p=>!p.alive);
                  if(deadNow.length > 0){
                    dm(sender, `💉 كبسولة الإحياء ظهرت الآن — أرسل رقم من تريد إعادته:\n${listText(deadNow)}`);
                  }
                  continue;
                }

                // المرحلة الثانية: كبسولة الإحياء
                if(!game.madScientistReviveUsed){
                  const deadTargets = game.players.filter(p=>!p.alive);
                  if(!deadTargets.length){ dm(sender, '💉 لا يوجد أموات لإحيائهم.'); continue; }
                  const target = deadTargets[num - 1];
                  if(!target){ dm(sender, STR.invalidTarget); continue; }
                  game.madScientistReviveUsed = true;
                  target.alive = true;
                  dm(sender, `💉 تم الإحياء — ${target.name} عاد إلى الحياة!`);
                  await sendWait(game.threadMainID,
                    withMentions(`🧪 العالم المجنون استخدم كبسولة الإحياء — ${target.name} عاد إلى الحياة من بين الأموات!`, [target.name, target.userID]),
                    1500);
                  saveGame(game);
                  continue;
                }

                // انتهت الكبسولتان
                dm(sender, '🧪 انتهت كبسولاتك — لا يوجد المزيد.');
                continue;
              }

              // Lover: link two players via "X+Y" — only in round 1 before linking
              if(player.role === 'خطابة'){
                // Already linked or past round 1 — no action available, ignore silently
                if(Object.keys(game.loverLinks || {}).length > 0 || game.round > 1){
                  continue;
                }
                const match = text.match(/^(\d+)\+(\d+)$/);
                if(match){
                  const others = game.players.filter(p=>p.alive && p.userID !== sender);
                  const n1 = parseInt(match[1]); const n2 = parseInt(match[2]);
                  if(n1 < 1 || n1 > others.length || n2 < 1 || n2 > others.length || n1 === n2){
                    await dm(sender, STR.loverInvalidPair); continue;
                  }
                  const p1 = others[n1-1]; const p2 = others[n2-1];
                  if(!game.loverLinks) game.loverLinks = {};
                  game.loverLinks[p1.userID] = p2.userID;
                  game.loverLinks[p2.userID] = p1.userID;
                  await dm(sender, `تم ربط ${p1.name} و ${p2.name}💔`);
                  await dm(p1.userID, STR.loverNotified(p2.name));
                  await dm(p2.userID, STR.loverNotified(p1.name));
                  saveGame(game);
                  checkEarlyNight(game.id);
                } else {
                  await dm(sender, STR.loverInvalidPair);
                }
                continue;
              }
              const noNightRoles = ['مواطن', 'مهرج'];
              if(noNightRoles.includes(player.role)) continue;
              // Sniper — queues target for resolveNight
              if(player.role === 'قناص'){
                if(game.sniperUsed){ dm(sender, STR.sniperAlreadyUsed); continue; }
                if(game.actionQueue[sender]){ continue; }
                const sniperAlive = game.players.filter(p=>p.alive && p.userID !== sender);
                const tid = resolveTarget(text, sniperAlive);
                if(!tid){ dm(sender, STR.invalidTarget); continue; }
                const targetPlayer = game.players.find(p=>p.userID===tid);
                game.actionQueue[sender] = {target:tid};
                dm(sender, `تم قنص ${targetPlayer?targetPlayer.name:'الهدف'}🎯`);
                saveGame(game);
                checkEarlyNight(game.id);
                continue;
              }
              // Build target list identical to the prompt sent at night start
              const mafiaPartner = player.role === 'مافيا'
                ? game.players.find(x => x.userID !== sender && x.role === 'مافيا')
                : null;
              const alive = game.players.filter(p =>
                p.alive &&
                p.userID !== sender &&
                (!mafiaPartner || p.userID !== mafiaPartner.userID)
              );
              const tid=resolveTarget(text,alive);
              if(!tid){ dm(sender,STR.invalidTarget); continue; }
              // Prevent mafia from targeting their partner
              if(player.role === 'مافيا'){
                const targetPlayer = alive.find(p=>p.userID===tid);
                if(targetPlayer && targetPlayer.role === 'مافيا'){
                  dm(sender, '⚠️ هذا شريكك — لا يمكنك استهدافه!');
                  continue;
                }
              }
              if(game.actionQueue[sender]){ continue; }
              game.actionQueue[sender]={target:tid};
              if(player.role === 'محقق'){
                const target = game.players.find(p=>p.userID===tid);
                const verdict = target && target.role === 'مافيا' ? '🔴 مافيا — يداه ملطّختان بالدم' : '🟢 بريء — على ما يبدو';
                dm(sender, `🔍 تحقيقك عن ${target ? target.name : tid}: ${verdict}`);
              } else if(player.role === 'جلاد'){
                const target = game.players.find(p=>p.userID===tid);
                dm(sender, `تم تقييد ${target?target.name:tid}⛓️`);
              } else if(player.role === 'مافيا'){
                const target = game.players.find(p=>p.userID===tid);
                dm(sender, `${target ? target.name : 'الهدف'} سيموت 😈`);
              } else if(player.role === 'طبيب'){
                const target = game.players.find(p=>p.userID===tid);
                dm(sender, `حمايتك وصلت ل ${target ? target.name : 'الهدف'} 👨‍⚕️`);
              } else if(player.role === 'SCP-096'){
                const target = game.players.find(p=>p.userID===tid);
                dm(sender, `انتهى أمر ${target ? target.name : 'الهدف'} ☣️`);
              } else if(player.role === 'نهاب'){
                const target = game.players.find(p=>p.userID===tid);
                dm(sender, `🦹 ممتاز... ستسرق دور ${target ? target.name : 'الهدف'} عند الفجر.`);
              } else if(player.role === 'دراكولا'){
                const target = game.players.find(p=>p.userID===tid);
                if(target && target.role === 'مافيا'){
                  dm(sender, `خارج النطاق`);
                } else {
                  dm(sender, `🧛 ممتاز... سيتحول ${target ? target.name : 'الهدف'} إلى مصاص دماء `);
                }
              } else {
                dm(sender, STR.actionReceived);
              }
              saveGame(game);
              checkEarlyNight(game.id);
            }
          }
        }
      }

    }catch(e){ console.error('event error',e); }
    });
  }
  startListening();


  function buildRules(){
    return `📜 قواعد لعبة المافيا\n\n🎮 كيف تلعب؟\n  ▸ اكتب "ابدأ" لفتح باب الانضمام\n  ▸ تفاعل على رسالة اللعبة للدخول\n  ▸ دورك يصلك في الخاص\n  ▸ في الليل: نفّذ دورك عبر الخاص\n  ▸ في النهار: صوّت عبر الخاص\n\n🎭 الأدوار:\n${Object.entries(ROLE_DESCS).map(([r,d])=>`\n${r}:\n${d}`).join('\n')}`;
  }

});
