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
  join:          `🚪 أبواب اللعبة تُفتح! تفاعل مع هذه الرسالة للانضمام.`,
  joinConfirm:   (name) => `✅ تم تسجيلك بنجاح، ${name}.`,
  roleDM:        (name, role, desc) => `🎭 ${name}\nدورك السري: ${role}\n\n${desc}\n\nاحفظ سرك — لا تخبر أحداً.`,
  nightPrompt:   (round, role, list) => `🌑 الليلة ${round} — دورك: ${role}\n\nاختر هدفك بإرسال الرقم أو الاسم:\n${list}`,
  dayPrompt:     (round, list) => `🌇 نهار ${round} — وقت التصويت!\n\nاختر من تريد إعدامه بالرد برقمه أو اسمه:\n${list}`,
  actionReceived:`✔️ تم استلام قرارك.`,
  cancelledAct:  `❌ اخترت أكثر من مرة — تم إلغاء اختيارك.`,
  invalidTarget: `⚠️ اختيار غير صالح. أرسل رقم أو اسم من القائمة.`,
  cannotActDead: `💀 أنت ميت ولا تستطيع الفعل.`,
  noDeaths:      `☀️ لم يمت أحد الليلة.`,
  morningDeath:  (name, role) => `☀️ ${name} لم ينجُ الليلة. كان دوره: ${role}`,
  voteResult:    (name) => `⚖️ تم إعدام ${name}.`,
  tie:           `تعادل في التصويت — لا إعدام.`,
  listsVertical: (a, d) => `🌿 الأحياء:\n${a}\n\n💀 الأموات:\n${d}`,
  gameOver:      (winner, reason, players) => `🏆 انتهت اللعبة!\nالفائز: ${winner}\nالسبب: ${reason}\n\n${players}`
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
function listText(players){ return players.map((p,i)=>`${i+1}: ${p.name}`).join('\n'); }
function aliveDeadText(game){
  const a = game.players.filter(p=>p.alive).map(p=>`• ${p.name}`).join('\n')||'لا أحد';
  const d = game.players.filter(p=>!p.alive).map(p=>`• ${p.name}`).join('\n')||'لا أحد';
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
  'مافيا':  'تختار ضحية كل ليلة. تنسق مع زملائك إن وُجدوا.',
  'محقق':   'تتحقق من هوية لاعب واحد كل ليلة (مافيا / غير مافيا).',
  'دكتور':  'تحمي لاعباً واحداً من الموت في الليلة.',
  'مواطن':  'لا قدرة خاصة — صوتك مهم.'
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
  const civs = roles.map((r,i)=>r==='مواطن'?i:-1).filter(x=>x>=0);
  if(civs.length>=1) roles[civs[0]]='دكتور';
  if(civs.length>=2) roles[civs[1]]='محقق';
  players.forEach((p,i)=>p.role=roles[i]);
}

// ---------- NIGHT RESOLUTION ----------
function resolveNight(game){
  const byId = Object.fromEntries(game.players.map(p=>[p.userID,p]));
  const safe = new Set(); const dead = new Set();
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='دكتور' && act.target) safe.add(act.target);
  }
  for(const [uid,act] of Object.entries(game.actionQueue)){
    const a=byId[uid]; if(!a||!a.alive) continue;
    if(a.role==='مافيا' && act.target && !safe.has(act.target)){ dead.add(act.target); break; }
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
const PLAYER_ROOMS = {}; // userID -> roomID (their private room from ROOM_IDS)

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function send(threadID, text){ if(!api) return; api.sendMessage({body:text}, threadID, (e)=>{ if(e) console.error('send error to', threadID, JSON.stringify(e)); }); }

// Search ROOM_IDS to find which room contains this player
function resolvePlayerRoom(userID){
  return new Promise((resolve)=>{
    if(PLAYER_ROOMS[userID]){ return resolve(PLAYER_ROOMS[userID]); }
    let checked = 0;
    for(const roomID of ROOM_IDS){
      api.getThreadInfo(roomID, (e, info)=>{
        checked++;
        if(!e && info && info.participantIDs && info.participantIDs.includes(userID)){
          PLAYER_ROOMS[userID] = roomID;
          console.log('Found room for', userID, '->', roomID);
          resolve(roomID);
          checked = ROOM_IDS.length;
        } else if(checked >= ROOM_IDS.length && !PLAYER_ROOMS[userID]){
          console.log('No room found for', userID, '- will use userID directly');
          resolve(null);
        }
      });
    }
    if(ROOM_IDS.length === 0) resolve(null);
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

    // join message in main room only
    send(threadID, STR.join);
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

    send(game.threadMainID, `🎭 تم توزيع الأدوار على ${game.players.length} لاعبين. .`);

    // send role via DM to each player with delay to avoid rate limiting
    for(const p of game.players){
      console.log('Sending role to', p.name, p.userID, 'role:', p.role);
      dm(p.userID, STR.roleDM(p.name, p.role, ROLE_DESCS[p.role]||''));
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
    const list = listText(alive);

    // send night prompt via DM to each alive player with delay
    for(const p of alive){
      dm(p.userID, STR.nightPrompt(game.round, p.role, list));
      await sleep(1500);
    }

    game.timers.night = setTimeout(()=>{
      const deaths = resolveNight(game);
      if(deaths.length===0){
        send(game.threadMainID, STR.noDeaths);
      } else {
        for(const d of deaths) send(game.threadMainID, STR.morningDeath(d.name, d.role));
      }
      send(game.threadMainID, aliveDeadText(game));
      game.log.push({round:game.round, deaths});
      saveGame(game);
      const win = checkWin(game);
      if(win.ended){ endGame(game,win); return; }
      startDay(gameId);
    }, DEFAULTS.nightWindowMs);
  }

  // ---- DAY ----
  function startDay(gameId){
    const game = GAMES[gameId]; if(!game) return;
    game.phase='day'; saveGame(game);
    for(const p of game.players){ p.vote=null; p._voted=false; }
    const alive = game.players.filter(p=>p.alive);
    send(game.threadMainID, STR.dayPrompt(game.round, listText(alive)));

    game.timers.day = setTimeout(()=>{
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
        if(ex){ ex.alive=false; send(game.threadMainID, STR.voteResult(ex.name)); }
      } else {
        send(game.threadMainID, STR.tie);
      }
      send(game.threadMainID, aliveDeadText(game));
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

          // DAY VOTE — from main room
          for(const gameId of Object.keys(GAMES)){
            const game=GAMES[gameId]; if(!game||game.phase!=='day') continue;
            if(game.threadMainID!==event.threadID) continue;
            const player=game.players.find(p=>p.userID===sender);
            if(!player||!player.alive) continue;
            const alive=game.players.filter(p=>p.alive);
            const tid=resolveTarget(text,alive);
            if(!tid) continue;
            if(player._voted){ player.vote=null; player._voted=false; send(event.threadID,STR.cancelledAct); saveGame(game); continue; }
            player.vote=tid; player._voted=true; send(event.threadID,'✔️ تم تسجيل صوتك.'); saveGame(game);
          }
        }

        // --- PRIVATE ROOM OR DM → NIGHT ACTION ---
        const isPrivateRoom = ROOM_IDS.includes(event.threadID);
        const isDM = event.threadID === sender || !event.isGroup;
        if(isPrivateRoom || isDM){
          for(const gameId of Object.keys(GAMES)){
            const game=GAMES[gameId]; if(!game||game.phase!=='night') continue;
            if(event.threadID === game.threadMainID) continue; // skip main room
            const player=game.players.find(p=>p.userID===sender);
            if(!player) continue;
            if(!player.alive){ dm(sender,STR.cannotActDead); continue; }
            const alive=game.players.filter(p=>p.alive);
            const tid=resolveTarget(text,alive);
            if(!tid){ dm(sender,STR.invalidTarget); continue; }
            if(game.actionQueue[sender]){ delete game.actionQueue[sender]; dm(sender,STR.cancelledAct); saveGame(game); continue; }
            game.actionQueue[sender]={target:tid};
            dm(sender,STR.actionReceived); saveGame(game);
          }
        }
      }

    }catch(e){ console.error('event error',e); }
    });
  }
  startListening();

  function buildRules(){
    return `📜 قواعد لعبة المافيا:\n\n- اكتب "ابدأ" لبدء اللعبة.\n- تفاعل على رسالة الانضمام للدخول.\n- دورك يصلك برسالة خاصة (DM).\n- في الليل: أرسل هدفك عبر DM.\n- في النهار: صوّت في هذه الغرفة.\n\nالأدوار:\n${Object.entries(ROLE_DESCS).map(([r,d])=>`• ${r}: ${d}`).join('\n')}`;
  }

});
