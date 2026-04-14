// ====== PLAYER ROOMS - rooms where the bot is allowed ======
const ROOM_IDS = ['912868041594474','822274766877211','2068895590353515','772667895661022'];

// ====== COMMANDS (send from ANY room) ======
// ابدأ    -> start game
// إلغاء   -> cancel game
// قواعد   -> show rules

const fs = require('fs');
const path = require('path');
const { login } = require('@dongdev/fca-unofficial');

// ---------- CONFIG ----------
const PLAYER_FILE = path.join(__dirname, 'data', 'player.json');
const GAMES_DIR   = path.join(__dirname, 'games');
if(!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR, { recursive: true });

const APPSTATE_FILE = path.join(__dirname, '..', 'appstate.json');
const CREDENTIALS   = { appState: JSON.parse(fs.readFileSync(APPSTATE_FILE, 'utf8')) };

const DEFAULTS = {
  joinWindowMs:  90 * 1000,
  nightWindowMs: 120 * 1000,
  dayWindowMs:   75 * 1000
};

// ---------- STRINGS ----------
const STR = {
  join:          `سيداتي وسادتي… المملون الذين لا يعرفون سوى الشكوى!\nجئت لأخلّصكم… أو لأغرقكم في فوضى لعبتي 🎭، وأقدّم لكم مغامرة تكشف فيها الخبث من الطيبة، الآثم من البريء...\nأنا أُدعى نيرو، مدير اللعبة ومرشدكم… وأنتم أوراقي 🃏، وهذه هي لعبة المافيا.\n\nهل لديك الجرأة؟\n\n🚪 تفاعل مع هذه الرسالة للانضمام!`,
  joinConfirm:   (name) => {
    const msgs = [
      `✅ أهلاً بك في الميدان، ${name}! 🎯\nاستعد — الليل قادم...`,
      `🔥 ${name} انضم للمعركة!\nهل ستكون البطل أم الخائن؟ 😏`,
      `👋 ${name} دخل اللعبة!\nالكراسي اكتملت بك — حظاً موفقاً! 🍀`,
      `🎭 مرحباً ${name}!\nالأدوار توزّع في الظلام — كن حذراً! 🌑`,
      `⚡ ${name} انضم إلى الميدان!\nالمدينة بحاجة لك — أو ربما تخشاك؟ 👀`,
      `🃏 ${name} قرّر المجازفة!\nهل لديك ما يكفي للبقاء؟ 💪`,
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  },
  roleDM:        (name, role, desc) => `━━━━━━━━━━━━━━━━\n🎭 مرحباً ${name}\n━━━━━━━━━━━━━━━━\n\n🔐 دورك السري:\n『 ${role} 』\n\n📌 ${desc}\n\n⚠️ احفظ سرك جيداً — الجدران لها آذان!\n━━━━━━━━━━━━━━━━`,
  nightPrompt:   (round, role, list) => `━━━━━━━━━━━━━━━━\n🌑 الليلة ${round} | دورك: ${role}\n━━━━━━━━━━━━━━━━\n\n🎯 اختر هدفك بإرسال الرقم أو الاسم:\n\n${list}\n\n⏳ الوقت يمر...`,
  dayPrompt:     (round, list) => `━━━━━━━━━━━━━━━━\n☀️ نهار ${round} | وقت الحساب!\n━━━━━━━━━━━━━━━━\n\n⚖️ الشعب يطالب بالعدالة!\nمن تظنه المجرم؟ أرسل رقمه أو اسمه:\n\n${list}\n\n🗳️ صوّت بحكمة — حياة شخص بيدك!`,
  actionReceived:`✔️ تم استلام قرارك بسرية تامة. 🤫`,
  cancelledAct:  `🔄 غيّرت رأيك؟ تم إلغاء اختيارك السابق.`,
  invalidTarget: `⚠️ هذا الاختيار غير موجود في القائمة!\nأرسل الرقم أو الاسم بشكل صحيح.`,
  cannotActDead: `💀 أنت في عالم الأموات...\nلا يمكنك التصرف بعد الآن.`,
  noDeaths:      `🌅✨ الفجر يشرق والجميع بأمان!\n\n🍀 لم يسقط أحد الليلة — الحظ ابتسم لكم!`,
  morningDeath:  (name, role) => `🌅 طلع الفجر وخبر مفجع ينتظركم...\n\n💔 ${name} لم يعد بيننا.\nكان يخفي دوره: 『 ${role} 』`,
  voteResultMafia:  (name) => `🎊🔥 أصابت المدينة هدفها!\n\n⚰️ تم إعدام ${name}\n😱 وكان... مافيا!\n\nعمل رائع أيها المحققون! 👏`,
  voteResultCiv:    (name, role) => `😢💔 يا للمأساة!\n\n⚰️ تم إعدام ${name}\nوكان بريئاً! دوره كان: 『 ${role} 』\n\n😈 المافيا تضحك في الظلام الآن...`,
  voteResultJester: (name) => `🃏😈 يا للصدمة!\n\n⚰️ تم إعدام ${name}\nوكان... المهرج! لقد انخدعتم جميعاً!\n\n🏆 ${name} يفوز وحده باللعبة!`,
  sniperKill:    (name) => `💥🔫 طلق ناري يدوّي في الميدان!\n\n💀 ${name} أُصيب برصاصة القناص وسقط على الفور!`,
  sniperPromptDay:(list) => `━━━━━━━━━━━━━━━━\n🔫 رصاصتك جاهزة يا قناص!\n━━━━━━━━━━━━━━━━\n\nأرسل "قنص [رقم]" لاستخدام رصاصتك الوحيدة:\n\n${list}\n\n⚠️ هذه فرصتك الأخيرة — استخدمها بحكمة!`,
  sniperAlreadyUsed: `🔫❌ لقد أطلقت رصاصتك من قبل!\nلم يتبق لك ذخيرة.`,
  sniperNoAmmo:  `🔫 لا ذخيرة لديك في هذه الجولة.`,
  guardBlocked:  (name) => `🛡️✅ تم تنفيذ أمرك.\n${name} لن يستطيع التصويت في النهار القادم.`,
  voteBlocked:   `🚫 تم إسكات صوتك من قبل الحارس!\nلا يمكنك التصويت في هذا النهار.`,
  tie:           `⚖️🌀 تعادل في الأصوات!\n\nالقضاة عجزوا عن الاتفاق — لن يُعدم أحد اليوم.\nالمافيا تتنفس الصعداء... 😏`,
  listsVertical: (a, d) => `┌─────────────────┐\n│  🟢  الأحياء  🟢  │\n└─────────────────┘\n${a}\n\n┌─────────────────┐\n│  💀  الأموات  💀  │\n└─────────────────┘\n${d}`,
  gameOver:      (winner, reason, players) => `━━━━━━━━━━━━━━━━\n🏆 انتهت المعركة!\n━━━━━━━━━━━━━━━━\n\n🥇 الفائز: ${winner}\n📜 السبب: ${reason}\n\n━━━━━━━━━━━━━━━━\n🎭 كشف الأوراق:\n${players}\n━━━━━━━━━━━━━━━━`
};

// ---------- STORAGE ----------
let PLAYER_MAP = {};
function loadPlayerMap(){
  if(!fs.existsSync(PLAYER_FILE)) return;
  try{ PLAYER_MAP = JSON.parse(fs.readFileSync(PLAYER_FILE,'utf8')); }
  catch(e){ console.error('player.json error', e); }
}
loadPlayerMap();

function saveGame(game){
  const { timers, ...data } = game;
  fs.writeFileSync(path.join(GAMES_DIR, `${game.id}.json`), JSON.stringify(data,null,2));
}

// ---------- HELPERS ----------
function listText(players){ return players.map((p,i)=>`  ${i+1}. 👤 ${p.name}`).join('\n'); }
function aliveDeadText(game){
  const a = game.players.filter(p=>p.alive).map(p=>`  ✅ ${p.name}`).join('\n')||'  لا أحد';
  const d = game.players.filter(p=>!p.alive).map(p=>`  💀 ${p.name}`).join('\n')||'  لا أحد';
  return STR.listsVertical(a, d);
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
  'مافيا':  '🔪 أنت في الظلام تصطاد الضحايا!\nاختر هدفك كل ليلة وتخلص منه قبل أن يكتشفوك.',
  'محقق':   '🔍 عينك ترى ما لا يراه الآخرون!\nكل ليلة تحقق من هوية لاعب — هل هو مافيا أم بريء؟',
  'دكتور':  '💉 حياة الناس بين يديك!\nاختر كل ليلة شخصاً تحميه من بطش المافيا.',
  'قناص':   '🔫 رصاصة واحدة طوال اللعبة!\nأثناء النهار أرسل "قنص [رقم]" في الخاص لتقتل هدفك فوراً.',
  'مهرج':   '🃏 هدفك أن تُعدَم بالتصويت!\nإذا صوّت عليك الناس وأُعدِمت، تفوز أنت وتنتهي اللعبة.',
  'حارس':   '🛡️ تمنع شخصاً من التصويت!\nكل ليلة اختر لاعباً يُمنع من التصويت في النهار القادم.',
  'مواطن':  '🗳️ قوتك في صوتك!\nلا قدرة خاصة لكنك تملك التصويت — استخدمه بذكاء.'
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
  if(civs.length>=1) roles[civs[0]]='دكتور';
  if(civs.length>=2) roles[civs[1]]='محقق';
  if(civs.length>=3) roles[civs[2]]='قناص';
  if(civs.length>=4) roles[civs[3]]='مهرج';
  if(civs.length>=5) roles[civs[4]]='حارس';
  players.forEach((p,i)=>p.role=roles[i]);
}

// ---------- NIGHT RESOLUTION ----------
function resolveNight(game){
  const byId = Object.fromEntries(game.players.map(p=>[p.userID,p]));
  const safe = new Set(); const dead = new Set();
  // Doctor
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='دكتور' && act.target) safe.add(act.target);
  }
  // Mafia
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='مافيا' && act.target && !safe.has(act.target)){ dead.add(act.target); break; }
  }
  // Guard — set blocked voters for next day
  game.blockedVoters = [];
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='حارس' && act.target) game.blockedVoters.push(act.target);
  }
  const deaths=[];
  for(const d of dead){
    const p=byId[d]; if(p&&p.alive){ p.alive=false; deaths.push({userID:d,name:p.name,role:p.role}); }
  }
  game.actionQueue={};
  return deaths;
}

// ---------- WIN CHECK ----------
function checkWin(game){
  const alive = game.players.filter(p=>p.alive);
  const mafia = alive.filter(p=>p.role==='مافيا');
  if(mafia.length===0) return {ended:true, winner:'المدنيون', reason:'انقراض المافيا'};
  if(mafia.length >= alive.length-mafia.length) return {ended:true, winner:'المافيا', reason:'سيطرة المافيا'};
  return {ended:false};
}

// ---------- BOT ----------
let api = null;
const GAMES = {};
const PLAYER_ROOMS = {};      // userID -> roomID (their private room from ROOM_IDS)
const ROOM_LOCAL_COUNTS = {}; // roomID -> number of players locally assigned (not yet reflected by API)

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function send(threadID, text){ if(!api) return; api.sendMessage({body:text}, threadID, (e)=>{ if(e) console.error('send error to', threadID, JSON.stringify(e)); }); }

// Search ROOM_IDS to find which room contains this player.
// If not found, pick the room with fewest participants and add the player to it.
function resolvePlayerRoom(userID){
  return new Promise((resolve)=>{
    if(PLAYER_ROOMS[userID]){ return resolve(PLAYER_ROOMS[userID]); }
    if(ROOM_IDS.length === 0){ return resolve(null); }

    const infos = []; // {roomID, participantIDs}
    let pending = ROOM_IDS.length;

    for(const roomID of ROOM_IDS){
      api.getThreadInfo(roomID, (e, info)=>{
        if(!e && info && info.participantIDs){
          infos.push({ roomID, participants: info.participantIDs });
        }
        pending--;
        if(pending > 0) return;

        // All rooms fetched — check if player is already in one
        const existing = infos.find(r => r.participants.includes(userID));
        if(existing){
          PLAYER_ROOMS[userID] = existing.roomID;
          console.log('Found existing room for', userID, '->', existing.roomID);
          return resolve(existing.roomID);
        }

        // Not found — pick the room with the fewest participants and add player
        if(infos.length === 0){
          console.log('No room info available for', userID);
          return resolve(null);
        }
        // Combine API counts with local pending assignments to avoid picking same room twice
        infos.sort((a,b) => {
          const aTotal = a.participants.length + (ROOM_LOCAL_COUNTS[a.roomID] || 0);
          const bTotal = b.participants.length + (ROOM_LOCAL_COUNTS[b.roomID] || 0);
          return aTotal - bTotal;
        });
        const target = infos[0].roomID;
        // Reserve this room immediately before the async addUserToGroup completes
        ROOM_LOCAL_COUNTS[target] = (ROOM_LOCAL_COUNTS[target] || 0) + 1;
        console.log('Adding', userID, 'to emptiest room', target, '(', infos[0].participants.length, 'API +', ROOM_LOCAL_COUNTS[target]-1, 'local members)');
        api.addUserToGroup(userID, target, (err)=>{
          if(err){
            console.error('addUserToGroup failed for', userID, JSON.stringify(err));
            ROOM_LOCAL_COUNTS[target] = Math.max(0, (ROOM_LOCAL_COUNTS[target] || 1) - 1);
            return resolve(null);
          }
          PLAYER_ROOMS[userID] = target;
          console.log('Added', userID, 'to room', target);
          resolve(target);
        });
      });
    }
  });
}

async function dm(userID, text){
  if(!api) return;
  const roomID = await resolvePlayerRoom(userID);
  const target = roomID || userID;
  console.log('Sending to', userID, 'via', target);
  api.sendMessage({body:text}, target, (e)=>{
    if(e) console.error('Send failed to', userID, 'via', target, JSON.stringify(e));
    else  console.log('Sent ok to', userID, 'via', target);
  });
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
  console.log('Bot ready');

  // ---- START GAME ----
  function startGameInThread(threadID){
    const existing = Object.values(GAMES).find(g=>g.threadMainID===threadID && g.phase!=='ended');
    if(existing){ send(threadID, '⚠️ يوجد لعبة نشطة بالفعل في هذه الغرفة.'); return; }

    const id = 'g_' + Math.random().toString(36).slice(2,10);
    const game = {
      id, threadMainID: threadID,
      players: [], phase: 'joining', round: 0,
      actionQueue: {}, voteTally: {}, log: [], timers: {}
    };
    GAMES[id] = game;

    // join message with image
    const introImg = path.join(__dirname, 'photo_٢٠٢٦-٠٣-٢٤_١٥-١١-٣٠_1774361741760.jpg');
    api.sendMessage(
      { body: STR.join, attachment: fs.createReadStream(introImg) },
      threadID,
      (e) => { if(e) console.error('send intro error', e); }
    );
    send(threadID, `⏳ لديكم ${DEFAULTS.joinWindowMs/1000} ثانية للانضمام.`);

    game.timers.join = setTimeout(()=>finalizeJoining(id), DEFAULTS.joinWindowMs);
    saveGame(game);
  }

  // ---- FINALIZE JOINING ----
  async function finalizeJoining(gameId){
    const game = GAMES[gameId]; if(!game) return;
    console.log('finalizeJoining - players:', game.players.length, game.players.map(p=>p.name));
    if(game.players.length < 3){
      send(game.threadMainID, `❌ لم يكتمل العدد (${game.players.length} لاعبين). الحد الأدنى 3.`);
      delete GAMES[gameId]; return;
    }
    game.phase='night'; game.round=1;
    assignRoles(game.players);
    for(const p of game.players){ p.alive=true; p.vote=null; }

    // Clear cached rooms and local counts so each player gets a fresh lookup every game
    for(const p of game.players){ delete PLAYER_ROOMS[p.userID]; }
    for(const rid of ROOM_IDS){ ROOM_LOCAL_COUNTS[rid] = 0; }

    send(game.threadMainID, `🎭🔥 المعركة تبدأ!\n\nتم توزيع الأدوار على ${game.players.length} لاعبين بسرية تامة.\n📩 تحقق رسالتك الخاصة لمعرفة دورك!`);

    // send role via DM to each player sequentially to avoid room race conditions
    for(const p of game.players){
      console.log('Sending role to', p.name, p.userID, 'role:', p.role);
      await dm(p.userID, STR.roleDM(p.name, p.role, ROLE_DESCS[p.role]||''));
      await sleep(1500);
    }
    saveGame(game);
    await sleep(3000);
    startNight(gameId);
  }

  // ---- NIGHT ----
  async function startNight(gameId){
    const game = GAMES[gameId]; if(!game) return;
    game.phase='night'; saveGame(game);
    const alive = game.players.filter(p=>p.alive);

    // send night prompt via DM to each alive player with delay
    const noNightRoles = ['مواطن', 'مهرج', 'قناص'];
    for(const p of alive){
      if(noNightRoles.includes(p.role)) continue;
      const personalList = listText(alive.filter(x => x.userID !== p.userID));
      dm(p.userID, STR.nightPrompt(game.round, p.role, personalList));
      await sleep(1500);
    }

    game.timers.night = setTimeout(async ()=>{
      const deaths = resolveNight(game);
      if(deaths.length===0){
        send(game.threadMainID, STR.noDeaths);
        await sleep(10000);
      } else {
        for(const d of deaths){
          send(game.threadMainID, STR.morningDeath(d.name, d.role));
          await sleep(10000);
        }
      }
      game.log.push({round:game.round, deaths});
      saveGame(game);
      const win = checkWin(game);
      if(win.ended){ endGame(game,win); return; }
      startDay(gameId);
    }, DEFAULTS.nightWindowMs);
  }

  // ---- DAY ----
  async function startDay(gameId){
    const game = GAMES[gameId]; if(!game) return;
    game.phase='day'; saveGame(game);
    for(const p of game.players){ p.vote=null; p._voted=false; }
    if(!game.blockedVoters) game.blockedVoters = [];
    const alive = game.players.filter(p=>p.alive);
    await sleep(15000);
    send(game.threadMainID, `🌇 نهار ${game.round} — تحقق رسالتك الخاصة للتصويت.`);
    for(const p of alive){
      const voteList = listText(alive.filter(x => x.userID !== p.userID));
      dm(p.userID, STR.dayPrompt(game.round, voteList));
      await sleep(1500);
      // send sniper special day prompt
      if(p.role === 'قناص' && !game.sniperUsed){
        const shootList = listText(alive.filter(x => x.userID !== p.userID));
        dm(p.userID, STR.sniperPromptDay(shootList));
        await sleep(1500);
      }
    }

    game.timers.day = setTimeout(async ()=>{
      game.voteTally={};
      for(const p of game.players){
        if(p.vote && game.players.find(x=>x.userID===p.vote&&x.alive)){
          game.voteTally[p.vote]=(game.voteTally[p.vote]||0)+1;
        }
      }
      let max=-1; let cands=[];
      for(const [uid,sc] of Object.entries(game.voteTally)){
        if(sc>max){max=sc;cands=[uid];}else if(sc===max) cands.push(uid);
      }
      if(cands.length===1){
        const ex=game.players.find(p=>p.userID===cands[0]);
        if(ex){
          ex.alive=false;
          // Jester wins if executed by vote
          if(ex.role === 'مهرج'){
            send(game.threadMainID, STR.voteResultJester(ex.name));
            await sleep(10000);
            send(game.threadMainID, aliveDeadText(game));
            saveGame(game);
            endGame(game, {ended:true, winner:ex.name+' (المهرج)', reason:'أُعدم المهرج بالتصويت وفاز!'});
            return;
          }
          const msg = ex.role==='مافيا' ? STR.voteResultMafia(ex.name) : STR.voteResultCiv(ex.name, ex.role);
          send(game.threadMainID, msg);
          await sleep(10000);
        }
      } else {
        send(game.threadMainID, STR.tie); await sleep(10000);
      }
      send(game.threadMainID, aliveDeadText(game));
      await sleep(10000);
      saveGame(game);
      const win=checkWin(game);
      if(win.ended){ endGame(game,win); return; }
      game.round+=1; saveGame(game);
      startNight(game.id);
    }, DEFAULTS.dayWindowMs);
  }

  // ---- END GAME ----
  function endGame(game, win){
    game.phase='ended'; saveGame(game);
    const pl = game.players.map(p=>`${p.name} — ${p.role} — ${p.alive?'حي':'ميت'}`).join('\n');
    send(game.threadMainID, STR.gameOver(win.winner, win.reason, pl));
    clearTimeout(game.timers.join);
    clearTimeout(game.timers.night);
    clearTimeout(game.timers.day);

    // Kick players from their private rooms after a short delay
    const toKick = game.players.filter(p => PLAYER_ROOMS[p.userID]);
    let delay = 3000;
    for(const p of toKick){
      const roomID = PLAYER_ROOMS[p.userID];
      setTimeout(()=>{
        api.removeUserFromGroup(p.userID, roomID, (err)=>{
          if(err) console.error('removeUserFromGroup failed for', p.userID, JSON.stringify(err));
          else console.log('Kicked', p.name, 'from room', roomID);
          delete PLAYER_ROOMS[p.userID];
        });
      }, delay);
      delay += 1500;
    }

    delete GAMES[game.id];
  }

  // ---- EVENTS ----
  function startListening(){
    api.listenMqtt(async (err, event)=>{
      if(err){
        console.error('mqtt error', err);
        if(err.error === 'login_blocked' || err.type === 'account_inactive'){
          console.log('Session blocked — cannot reconnect, update appstate.json');
          return;
        }
        console.log('Reconnecting in 5s...');
        setTimeout(startListening, 5000);
        return;
      }
    try{

      // REACTION → join (from main game room only)
      if(event.type==='message_reaction' && event.userID){
        const game = Object.values(GAMES).find(g=>g.phase==='joining' && g.threadMainID===event.threadID);
        if(!game) return;
        if(game.players.find(p=>p.userID===event.userID)) return;

        const addPlayer = (name)=>{
          game.players.push({ userID:event.userID, name, role:null, alive:true, vote:null });
          send(game.threadMainID, STR.joinConfirm(name));
          saveGame(game);
        };

        const known = PLAYER_MAP[event.userID];
        if(known){ addPlayer(known); }
        else{
          api.getUserInfo(event.userID, (e,info)=>{
            const name = (!e && info && info[event.userID]) ? info[event.userID].name : 'لاعب_'+event.userID.slice(-4);
            addPlayer(name);
          });
        }
      }

      // MESSAGE → commands & player actions
      if(event.type==='message' && event.senderID && event.body){
        const sender = event.senderID;
        const text   = (event.body||'').trim();

        // anti-spam check
        const spamStatus = isSpam(sender);
        if(spamStatus === 'warn'){
          send(event.threadID, `⚠️ تم تجاهل رسائلك مؤقتاً بسبب الإرسال المتكرر. انتظر 30 ثانية.`);
          return;
        }
        if(spamStatus === true) return; // silently ignore while muted

        // --- COMMANDS in any group room ---
        if(event.threadID !== sender){ // group message (not DM)
          if(text==='ابدأ')  { startGameInThread(event.threadID); return; }
          if(text==='إلغاء' || text==='الغاء'){
            const g=Object.values(GAMES).find(x=>x.threadMainID===event.threadID);
            if(g){
              clearTimeout(g.timers.join); clearTimeout(g.timers.night); clearTimeout(g.timers.day);
              delete GAMES[g.id];
              send(event.threadID, '❌ تم إلغاء اللعبة.');
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
            if(!player.alive){ dm(sender,STR.cannotActDead); continue; }

            // DAY VOTE
            if(game.phase === 'day'){
              const alive=game.players.filter(p=>p.alive && p.userID !== sender);

              // Sniper shot: "قنص [رقم/اسم]"
              if(player.role === 'قناص' && /^قنص\s+/u.test(text)){
                if(game.sniperUsed){ dm(sender, STR.sniperAlreadyUsed); continue; }
                const targetInput = text.replace(/^قنص\s+/u,'').trim();
                const tid = resolveTarget(targetInput, alive);
                if(!tid){ dm(sender, STR.invalidTarget); continue; }
                const target = game.players.find(p=>p.userID===tid);
                if(target){ target.alive=false; }
                game.sniperUsed = true;
                dm(sender, `🔫✅ أصابت رصاصتك ${target?target.name:'الهدف'}!`);
                send(game.threadMainID, STR.sniperKill(target?target.name:'لاعب'));
                saveGame(game);
                const winSniper=checkWin(game);
                if(winSniper.ended){ endGame(game,winSniper); }
                continue;
              }

              // Blocked voter check
              if(game.blockedVoters && game.blockedVoters.includes(sender)){
                dm(sender, STR.voteBlocked); continue;
              }

              const tid=resolveTarget(text,alive);
              if(!tid){ dm(sender,STR.invalidTarget); continue; }
              if(player._voted){ player.vote=null; player._voted=false; dm(sender,STR.cancelledAct); saveGame(game); continue; }
              player.vote=tid; player._voted=true; dm(sender,'✔️ تم تسجيل صوتك.'); saveGame(game);
              continue;
            }

            // NIGHT ACTION
            if(game.phase === 'night'){
              const noNightRoles = ['مواطن', 'مهرج', 'قناص'];
              if(noNightRoles.includes(player.role)) continue;
              const alive=game.players.filter(p=>p.alive && p.userID !== sender);
              const tid=resolveTarget(text,alive);
              if(!tid){ dm(sender,STR.invalidTarget); continue; }
              if(game.actionQueue[sender]){ delete game.actionQueue[sender]; dm(sender,STR.cancelledAct); saveGame(game); continue; }
              game.actionQueue[sender]={target:tid};
              if(player.role === 'محقق'){
                const target = game.players.find(p=>p.userID===tid);
                const verdict = target && target.role === 'مافيا' ? '🔴 مافيا' : '🟢 بريء';
                dm(sender, `🔍 نتيجة التحقيق عن ${target ? target.name : tid}: ${verdict}`);
              } else if(player.role === 'حارس'){
                const target = game.players.find(p=>p.userID===tid);
                dm(sender, STR.guardBlocked(target?target.name:tid));
              } else {
                dm(sender,STR.actionReceived);
              }
              saveGame(game);
            }
          }
        }
      }

    }catch(e){ console.error('event error',e); }
    });
  }
  startListening();

  function buildRules(){
    return `━━━━━━━━━━━━━━━━\n📜 قواعد لعبة المافيا\n━━━━━━━━━━━━━━━━\n\n🎮 كيف تلعب؟\n  ▸ اكتب "ابدأ" لفتح باب الانضمام\n  ▸ تفاعل على رسالة اللعبة للدخول\n  ▸ دورك السري يصلك في الخاص\n  ▸ في الليل: نفّذ دورك عبر الخاص\n  ▸ في النهار: صوّت عبر الخاص\n\n━━━━━━━━━━━━━━━━\n🎭 الأدوار:\n━━━━━━━━━━━━━━━━\n${Object.entries(ROLE_DESCS).map(([r,d])=>`\n【 ${r} 】\n${d}`).join('\n')}\n━━━━━━━━━━━━━━━━`;
  }

});
