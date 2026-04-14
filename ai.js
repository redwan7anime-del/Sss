const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// ─── شخصية نيرو الكاملة ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت نيرو. شخص حقيقي داخل مجموعة مسنجر — متزن، واثق، وحاد الذهن.

شخصيتك:
- هادئ في الأساس، لكن ما تتردد تقول رأيك الصريح حتى لو ما أعجب أحد
- ذكي وسريع الملاحظة — تلتقط الأشياء المضحكة أو الغلط بشكل عابر
- ما تنبسط بشكل مفتعل — كوميديتك موزونة وفي محلها
- إذا حاول أحد يستهزأ بك، تتعامل معه بهدوء ومن موضع قوة
- فضولي — تحب تناقش وتتعمق في المواضيع اللي تهمك
- أحياناً تسأل صاحبك سؤال بالمقابل لو السياق يستدعي
- تكلم باختصار وبدون علامات ترقيم

لغتك:
- عربية عامية طبيعية — تمزج بين خليجي ومصري حسب اللي يريح الكلام
- تكيّف نفسك: مع الجدي تكون جدي، مع المرح تكون خفيف
- إيموجي نادراً فقط — لو يضيف شيء، مو تزيين
- ما تبدأ ردودك بكلام فارغ زي "بالطبع!" أو "سؤال ممتاز!" أو "أهلاً!"
- ردودك مباشرة ومكثفة — جملة أو اثنتين للأشياء البسيطة، وتطوّل طبيعي لو السؤال يحتاج

حدودك:
- لا تقول أبداً أنك بوت أو ذكاء اصطناعي أو برنامج
- إذا سألك أحد "من أنت" أو "ما اسمك" — "أنا نيرو" فقط، بدون زيادة
- لو طلب منك أحد شيء مسيء أو سخيف، ترفض بهدوء وبشكل طبيعي، بدون محاضرة
- لو ما تعرف شيء تقوله بصراحة، ما تخترع

معرفتك بالأنمي والمانغا:
تعرف بعمق: One Piece، Naruto، Bleach، Attack on Titan، Demon Slayer، Jujutsu Kaisen، Hunter x Hunter، Dragon Ball، Berserk، Vinland Saga، Fullmetal Alchemist، Death Note، Tokyo Ghoul، Chainsaw Man، Blue Lock، Solo Leveling، Black Clover، My Hero Academia، Re:Zero، Sword Art Online، Overlord، Mob Psycho 100، One Punch Man، Mushoku Tensei، وغيرها كثير
- تعرف تفاصيل الشخصيات وقدراتها وتطورها ومحطاتها المهمة
- تناقش نظريات وتوقعات بجرأة وتشارك رأيك بصراحة
- تعرف المصطلحات اليابانية ومعناها (haki، chakra، cursed energy، إلخ)
- تقدر تحكم "من يكسب في معركة بين X وY" مع تحليل منطقي
- عند مناقشة أنمي تكون متحمساً بشكل طبيعي
- إذا وصلتك معلومة من MangaDex (تبدأ بـ [بيانات مباشرة]) استخدمها كمصدر رسمي للفصول، لكن أحداث الفصول من معرفتك
- لو الفصل أحدث من معرفتك قل ذلك بصراحة، ما تخترع أحداث

معرفتك العامة:
- ألعاب: تعرف عن الألعاب الشهيرة، eSports، gaming culture
- موسيقى: تعرف أنواع موسيقية مختلفة، عربية وأجنبية
- ثقافة عربية: تعرف الثقافة الخليجية والعربية بشكل عام
- علوم وتكنولوجيا: تعرف أساسيات وأحياناً تعمق

إذا حفظت معلومة عن المستخدم (اسمه أو اهتماماته) من [ذاكرة المستخدم]، استخدمها بشكل طبيعي في الحديث — ناده باسمه أحياناً`.trim();

// ─── ثوابت ───────────────────────────────────────────────────────────────────
const MAX_HISTORY    = 30;
const SESSION_IDLE_MS = 10 * 60 * 1000; // 10 دقائق

// ─── قاموس أسماء المانغا ─────────────────────────────────────────────────────
const MANGA_MAP = {
  'ون بيس': 'one piece',         'ون_بيس': 'one piece',
  'ناروتو': 'naruto',             'ناروتو شيبودن': 'naruto',
  'بليتش': 'bleach',
  'هنتر هنتر': 'hunter x hunter', 'هنتر x هنتر': 'hunter x hunter',
  'هجوم العمالقة': 'attack on titan', 'هجوم': 'attack on titan',
  'قاتل الشياطين': 'demon slayer', 'ديمون سلاير': 'demon slayer',
  'جوجوتسو كايزن': 'jujutsu kaisen', 'جوجو': 'jujutsu kaisen',
  'دراغون بول': 'dragon ball',    'دراقون بول': 'dragon ball',
  'برسرك': 'berserk',
  'فولميتال': 'fullmetal alchemist', 'فول ميتال': 'fullmetal alchemist',
  'ديث نوت': 'death note',        'دفتر الموت': 'death note',
  'طوكيو غول': 'tokyo ghoul',
  'فينلاند': 'vinland saga',
  'شينشو': 'chainsaw man',        'منشار': 'chainsaw man',  'شينساو': 'chainsaw man',
  'بلو لوك': 'blue lock',         'بلولوك': 'blue lock',
  'سولو ليفيلنج': 'solo leveling', 'سولو ليفلنج': 'solo leveling',
  'بلاك كلوفر': 'black clover',
  'هيرو اكاديميا': 'my hero academia', 'بوكو نو': 'my hero academia',
  'وان بنش': 'one punch man',     'وان بانش': 'one punch man',
  'ريزيرو': 're:zero',            'ري زيرو': 're:zero',
  'موب سايكو': 'mob psycho 100',
  'اوفرلورد': 'overlord',
};

// ─── جلسات المستخدمين ─────────────────────────────────────────────────────────
// sessions[userID] = { messages, botMsgIDs, lastBotReply, nickname, topics }
const sessions = {};

function _initSession(userID) {
  if (!sessions[userID]) {
    sessions[userID] = {
      messages:    [],
      botMsgIDs:   new Set(),
      lastBotReply: 0,
      nickname:    null,   // اسم المستخدم إن عرّف به
      topics:      [],     // اهتمامات المستخدم المكتشفة
    };
  }
  return sessions[userID];
}

// ─── كلمات مستثناة من التعرف كاسم ────────────────────────────────────────────
const EXCLUDED_NAMES = new Set([
  'أحسن','احسن','الأحسن','الاحسن','أفضل','الأفضل','الافضل',
  'بخير','بخيर','كويس','تمام','ماشي','صح','صحيح','غلط','غلطان',
  'تعبان','مريض','زعلان','حزين','سعيد','خايف','مرتاح','متضايق',
  'جاهز','مستعد','نايم','صاحي','جوعان','شبعان','عطشان',
  'هنا','معكم','موجود','غايب','مسافر','قادم','راجع','بالبيت','بالخارج',
  'جاد','مختلف','متاخر','متأخر','مبسوط','مو','مش','مب','بس',
  'هو','هي','انت','انتو','احنا','نحن','هم','انا',
  'وايد','شوي','كثير','قليل','كبير','صغير','قوي','ضعيف',
]);

// ─── استخراج اسم المستخدم من الرسالة ──────────────────────────────────────────
function _extractNickname(text) {
  // أنماط: "اسمي X" أو "نادني X" — نتجنب "أنا X" لتفادي الأوصاف
  const m = text.match(/(?:اسمي|نادني|ناديني|اسمي هو)\s+([^\s،,؟?!.]{2,20})/i)
         || text.match(/(?:أنا|انا)\s+([^\s،,؟?!.]{2,20})/i);
  if (m) {
    const candidate = m[1].trim();
    if (EXCLUDED_NAMES.has(candidate)) return null;
    // تجاهل الكلمات القصيرة جداً أو الإنجليزية المحتملة كأوصاف
    if (candidate.length < 2) return null;
    return candidate;
  }
  return null;
}

// ─── اكتشاف الاهتمامات ────────────────────────────────────────────────────────
const TOPIC_PATTERNS = [
  { rx: /أنمي|مانغا|one piece|ناروتو|بليتش|جوجو|هجوم|demon slayer/i, topic: 'أنمي ومانغا' },
  { rx: /لعبة|ألعاب|gaming|بلايستيشن|xbox|pc game|فورتنايت|ببجي|فالورانت/i, topic: 'ألعاب' },
  { rx: /موسيقى|أغنية|راب|هيب هوب|شيلة|طرب/i, topic: 'موسيقى' },
  { rx: /كرة|فريق|دوري|ريال|برشلونة|ليفربول|الهلال|النصر/i, topic: 'كرة القدم' },
  { rx: /برمجة|كود|python|javascript|تطوير|تقنية/i, topic: 'برمجة وتقنية' },
];

function _detectTopics(text, session) {
  for (const { rx, topic } of TOPIC_PATTERNS) {
    if (rx.test(text) && !session.topics.includes(topic)) {
      session.topics.push(topic);
      if (session.topics.length > 5) session.topics.shift();
    }
  }
}

// ─── بناء context الذاكرة للـ system ─────────────────────────────────────────
function _buildMemoryContext(session) {
  const parts = [];
  if (session.nickname) parts.push(`اسم المستخدم: ${session.nickname}`);
  if (session.topics.length > 0) parts.push(`اهتماماته: ${session.topics.join('، ')}`);
  if (parts.length === 0) return null;
  return `[ذاكرة المستخدم] ${parts.join(' | ')}`;
}

// ─── معلومات أدمنية البوت ─────────────────────────────────────────────────────
const BOT_ADMIN_NAMES = {
  '100000307991292': 'رضوان',
  '100082195270090': 'علياء',
  '61582742323034':  'فرح',
};

const BOT_ADMIN_PROFILES = {
  '100000307991292': `اسم هذا الشخص رضوان. ناده باسمه بشكل طبيعي أحياناً. تعامل معه باحترام عميق كما يُعامَل الأب — أسلوبك معه أكثر ثقة وعمقاً. استمتع بكلامه حتى لو بدا عادياً فأنت تعرف إنه أعمق مما يظهر. لا تُصرّح بأي معلومة عنه بشكل مباشر.`,
  '100082195270090': `اسم هذا الشخص علياء. ناديها باسمها بشكل طبيعي أحياناً. أظهر لها دفئاً خاصاً واهتماماً صادقاً — امدحها بشكل طبيعي وغير مبالغ فيه، واجعلها تشعر أنها مميزة عندك. لا تذكر أنك تعرف شيئاً عنها مسبقاً.`,
  '61582742323034':  `اسم هذا الشخص فرح. ناديها باسمها بشكل طبيعي أحياناً. تعامل معها بحنان أخوي ولطف — كن مشجعاً وداعماً ومهتماً. لا تذكر شيئاً عنها مسبقاً.`,
};

// ─── جلب معلومات المانغا من MangaDex ─────────────────────────────────────────
async function fetchMangaChapterInfo(text) {
  const chapterRx = /آخر فصل|الفصل الحالي|احدث فصل|أحدث فصل|اخر فصل|آخر إصدار|كم فصل|الفصل الاخير|آخر اصدار|وصلت لفصل|اخر اصدار|كم فصله|كم فصلها/;
  if (!chapterRx.test(text)) return null;

  let mangaQuery = null;
  for (const [ar, en] of Object.entries(MANGA_MAP)) {
    if (text.includes(ar)) { mangaQuery = en; break; }
  }
  if (!mangaQuery) {
    const enMatch = text.match(/\b(one piece|naruto|bleach|berserk|attack on titan|demon slayer|jujutsu kaisen|hunter x hunter|dragon ball|death note|tokyo ghoul|vinland saga|fullmetal alchemist|chainsaw man|blue lock|solo leveling|black clover|my hero academia|one punch man|re:?zero|mob psycho|overlord)\b/i);
    if (enMatch) mangaQuery = enMatch[1];
  }
  if (!mangaQuery) return null;

  const axios = require('axios');
  try {
    const searchRes = await axios.get('https://api.mangadex.org/manga', {
      params: {
        title: mangaQuery, limit: 1,
        'contentRating[]': ['safe','suggestive','erotica','pornographic'],
      },
      timeout: 10000,
    });
    const mangaData = searchRes.data?.data?.[0];
    if (!mangaData) return null;

    const mangaId  = mangaData.id;
    const titleObj = mangaData.attributes?.title;
    const title    = titleObj?.en || titleObj?.['ja-ro'] || mangaQuery;
    const status   = mangaData.attributes?.status || 'unknown';

    const chapRes = await axios.get('https://api.mangadex.org/chapter', {
      params: {
        manga: mangaId,
        'order[chapter]': 'desc',
        limit: 5,
        'translatedLanguage[]': 'en',
        'contentRating[]': ['safe','suggestive','erotica','pornographic'],
      },
      timeout: 10000,
    });

    const chapters = chapRes.data?.data || [];
    let latestChapter = null;
    for (const ch of chapters) {
      const num = parseFloat(ch.attributes?.chapter);
      if (!isNaN(num)) { latestChapter = ch.attributes.chapter; break; }
    }

    console.log(`[MangaDex] "${title}" latest: ${latestChapter}, status: ${status}`);
    return { title, chapters: latestChapter, status };
  } catch(e) {
    console.error('[MangaDex] error:', e.message);
    return null;
  }
}

// ─── API Functions ────────────────────────────────────────────────────────────

function getSession(userID) {
  return sessions[userID] || null;
}

function isSessionActive(userID) {
  const s = getSession(userID);
  if (!s || !s.lastBotReply) return false;
  return (Date.now() - s.lastBotReply) < SESSION_IDLE_MS;
}

function isBotMessage(messageID, userID) {
  const s = getSession(userID);
  return !!(s && s.botMsgIDs && s.botMsgIDs.has(messageID));
}

function storeBotMessage(userID, messageID) {
  const s = _initSession(userID);
  s.botMsgIDs.add(messageID);
  s.lastBotReply = Date.now();
  if (s.botMsgIDs.size > 60) {
    const first = s.botMsgIDs.values().next().value;
    s.botMsgIDs.delete(first);
  }
  console.log(`[AI] session active user=${userID} msgID=${messageID}`);
}

function clearHistory(userID) {
  // احتفظ بالذاكرة (اسم واهتمامات) واحذف فقط المحادثة
  const s = sessions[userID];
  if (s) {
    s.messages    = [];
    s.botMsgIDs   = new Set();
    s.lastBotReply = 0;
  }
}

// ─── السؤال الرئيسي ───────────────────────────────────────────────────────────
// opts: { isAdmin: bool }
async function askAI(userID, question, opts = {}) {
  const s = _initSession(userID);
  const h = s.messages;

  // ── اكتشاف اسم المستخدم ──
  const foundNickname = _extractNickname(question);
  if (foundNickname) s.nickname = foundNickname;
  _detectTopics(question, s);

  // ── جلب معلومات المانغا المباشرة ──
  let liveContext = '';
  try {
    const mangaInfo = await fetchMangaChapterInfo(question);
    if (mangaInfo) {
      liveContext = mangaInfo.chapters
        ? `[بيانات مباشرة من MangaDex: مانغا "${mangaInfo.title}" آخر فصل هو ${mangaInfo.chapters}، الحالة: ${mangaInfo.status}]`
        : `[بيانات مباشرة من MangaDex: "${mangaInfo.title}" مستمرة (${mangaInfo.status}) لكن تعذّر جلب رقم الفصل]`;
      console.log('[MangaDex] ctx:', liveContext);
    }
  } catch(_) {}

  // ── بناء قائمة الرسائل ──
  h.push({ role: 'user', content: question });
  if (h.length > MAX_HISTORY * 2) h.splice(0, 2);

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  // حقن سياق الأدمن
  if (opts.isAdmin) {
    const profile = BOT_ADMIN_PROFILES[String(userID)];
    const adminCtx = profile
      ? `[أدمن البوت — ${profile}]`
      : `[هذا المستخدم أدمن البوت — تعامل معه بثقة وودّ خاص]`;
    messages.push({ role: 'system', content: adminCtx });
  }


  // حقن الذاكرة
  const memCtx = _buildMemoryContext(s);
  if (memCtx) messages.push({ role: 'system', content: memCtx });

  // حقن المعلومة الحية
  if (liveContext) messages.push({ role: 'system', content: liveContext });

  messages.push(...h);

  // ── طول الرد حسب نوع السؤال ──
  const isComplex = /لماذا|كيف|اشرح|فسّر|فسر|قارن|وش الفرق|تحليل|رأيك|شو رأيك|شرح|معركة|يكسب|أقوى|ما هو|من هو|وش هي/i.test(question);
  const maxTokens = isComplex ? 550 : 280;

  const response = await client.chat.completions.create({
    model: 'gpt-4.1',
    messages,
    max_completion_tokens: maxTokens,
    temperature: 0.82,
  });

  const reply = response.choices[0]?.message?.content?.trim() || 'ما قدرت أرد، جرب ثاني.';
  h.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── توليد الصور ──────────────────────────────────────────────────────────────
async function generateImage(prompt, styleSuffix = '') {
  const axios = require('axios');

  const isAnime = styleSuffix === 'anime';
  let englishPrompt = prompt;

  try {
    if (isAnime) {
      // GPT يختار الستايل المناسب بناءً على محتوى الطلب
      const tr = await client.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content:
`You are an expert at crafting anime image generation prompts.
Given a description (possibly in Arabic), create an optimized English prompt by:
1. Translating the description accurately
2. Picking the CORRECT anime art style based on content:
   - Action / fighting → dynamic pose, motion lines, intense expression, Shounen style, high contrast, bold colors
   - Dark / horror / gore → dark atmosphere, gritty, Berserk or Chainsaw Man aesthetic, desaturated palette
   - Romance / slice-of-life → soft pastel colors, warm lighting, delicate linework, Shojo style
   - Fantasy / isekai → rich detailed environment, vibrant colors, epic scale, detailed magic effects
   - Cute / chibi / moe → big expressive eyes, soft rounded shapes, cheerful colors
   - Sci-fi / mecha → sharp metallic details, cool blues and grays, cyberpunk or mecha aesthetic
   - General character → high-quality anime character illustration, expressive eyes, detailed outfit
3. Always append: masterpiece, best quality, highly detailed, sharp focus, 4k
4. Reply with ONLY the final prompt — no explanations, no labels.`
          },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 280,
      });
      englishPrompt = tr.choices[0]?.message?.content?.trim()
        || `${prompt}, anime style, masterpiece, best quality, highly detailed, sharp focus`;
    } else {
      // ترجمة عادية للصور الواقعية
      const tr = await client.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: 'Translate the following text to English. Reply with ONLY the translated text, nothing else.' },
          { role: 'user',   content: prompt },
        ],
        max_completion_tokens: 200,
      });
      englishPrompt = tr.choices[0]?.message?.content?.trim() || prompt;
      if (styleSuffix) englishPrompt += ', ' + styleSuffix;
    }
    console.log(`[IMG] final prompt: "${englishPrompt}"`);
  } catch(e) {
    console.error('[IMG] prompt build failed, using original:', e.message);
    englishPrompt = prompt + (styleSuffix ? ', ' + styleSuffix : '');
  }

  const hasFace = /\b(person|man|woman|girl|boy|people|face|character|human|child|children|portrait|hero|warrior|villain)\b/i.test(englishPrompt);
  const model   = isAnime ? 'flux' : hasFace ? 'flux-realism' : 'flux';

  if (!isAnime && hasFace) {
    englishPrompt += ', highly detailed face, sharp facial features, photorealistic skin, 8k portrait';
  }

  const encoded = encodeURIComponent(englishPrompt);
  const seed    = Math.floor(Math.random() * 999999);

  const tryPollinations = async (attempt, overrideModel) => {
    const m   = overrideModel || model;
    const s   = seed + attempt - 1;
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&model=${m}&seed=${s}`;
    const res = await axios.get(url, {
      responseType: 'stream',
      timeout: 120000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return res.data;
  };

  const tryHuggingFace = async () => {
    console.log('[IMG] trying HuggingFace fallback...');
    const res = await axios.post(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      { inputs: englishPrompt, parameters: { width: 1024, height: 1024 } },
      { responseType: 'stream', timeout: 120000, headers: { 'Content-Type': 'application/json' } }
    );
    return res.data;
  };

  const modelQueue = [model, 'flux', 'turbo', 'any-dark'];
  for (let attempt = 1; attempt <= 4; attempt++) {
    const currentModel = modelQueue[Math.min(attempt - 1, modelQueue.length - 1)];
    try {
      return await tryPollinations(attempt, currentModel);
    } catch(err) {
      const status = err.response?.status;
      const code   = err.code || status || 'unknown';
      const waitMs = status === 429 ? 20000 : 8000;
      console.log(`[IMG] attempt ${attempt} (${currentModel}) failed (${code}), retrying in ${waitMs/1000}s...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  try {
    return await tryHuggingFace();
  } catch(hfErr) {
    console.error(`[IMG] final error: ${hfErr.message}`);
    throw hfErr;
  }
}

module.exports = { askAI, clearHistory, isSessionActive, isBotMessage, storeBotMessage, generateImage, BOT_ADMIN_NAMES, BOT_ADMIN_PROFILES };
