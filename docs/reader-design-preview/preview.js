const events = [
  { id: 'book-swap', type: 'club', category: '读书会', poster: 'Book\nswap', posterZh: '晨间\n换书', title: '晨间好书交换', date: '2026-11-20', time: '10:00', places: 12, remaining: 9, intro: '带一本你愿意交给下一位读者的书，聊聊它陪伴过你的时刻，再带走一本新书。' },
  { id: 'city-walk', type: 'salon', category: '文学沙龙', poster: 'City\nwalks', posterZh: '城市\n漫游', title: '一本书里的城市漫游', date: '2026-11-21', time: '14:00', places: 24, remaining: 22, intro: '从书里的一条街、一间店或一扇窗出发，聊聊作家怎样把熟悉的城市写得值得再走一遍。' },
  { id: 'nature-book', type: 'family', category: '亲子', poster: 'Little\nfield notes', posterZh: '自然\n小手记', title: '把自然写进一本小书', date: '2026-11-27', time: '14:00', places: 16, remaining: 16, intro: '家长和孩子一起观察叶子的纹路和颜色，把发现画下来，装订成一本小小的自然手记。' },
  { id: 'winter-notes', type: 'nature', category: '自然与生活', poster: 'Winter\nfieldwork', posterZh: '冬日\n观察', title: '冬日自然观察手记', date: '2026-12-05', time: '14:00', places: 20, remaining: 20, intro: '看看冬天的湖岸有哪些被忽略的变化。从一枝、一叶和一阵风开始，写下自己的观察。' },
  { id: 'winter-poems', type: 'poetry', category: '诗歌', poster: 'Winter\nverses', posterZh: '围坐\n读诗', title: '围坐读诗：把冬天写下来', date: '2026-12-19', time: '14:00', places: 20, remaining: 20, intro: '带一首想在冬天读的诗，围坐朗读，再试着用几行字记下一个属于自己的冬日片段。' },
  { id: 'new-year', type: 'club', category: '读书会', poster: 'Reading\nresolutions', posterZh: '新年\n书单', title: '新年阅读计划交换会', date: '2027-01-09', time: '14:00', places: 24, remaining: 24, intro: '用一本想读的书开启新一年，和其他读者交换书单、阅读习惯和读完一本书的小方法。' },
];

const shelves = [
  { id: 'everyday', type: 'club', category: '文学', title: '阅读与日常', intro: '日常里的细小观察、熟悉的地方和亲近的人。', books: [
    ['人间草木', '汪曾祺', '写花木、食物和日常人物，笔下没有大事，却让人重新留意身边的气味、颜色和滋味。', 'human-grasses'],
    ['我与地坛', '史铁生', '从一座旧园写到亲情、孤独和生命的限度。适合慢一点读，也适合在需要安静的时候重读。', 'temple-of-earth'],
    ['雅舍小品', '梁实秋', '从住房、饮食到朋友，梁实秋用简短而俏皮的散文写出寻常生活的可爱之处。', 'yashe-essays'],
  ] },
  { id: 'nature', type: 'family', category: '博物', title: '湖边的自然笔记', intro: '从水边、昆虫和身边的生命开始，重新认识自然。', books: [
    ['瓦尔登湖', '亨利·戴维·梭罗', '从湖畔小屋的日常出发，记录四季与劳动，也追问人究竟需要多少东西才能生活。', 'walden'],
    ['昆虫记', '让-亨利·法布尔', '以耐心的实地观察记录昆虫如何觅食、筑巢、照料后代。适合随手选一篇开始读。', 'insect-stories'],
    ['寂静的春天', '蕾切尔·卡森', '从鸟鸣消失的想象开篇，追踪农药如何沿食物链影响生态，把熟悉的春天放回更大的环境里看。', 'silent-spring'],
  ] },
  { id: 'streets', type: 'salon', category: '城市与地方', title: '街巷里的慢时光', intro: '从回忆、想象和街巷出发，以三种方式读一座城。', books: [
    ['朝花夕拾', '鲁迅', '从百草园、三味书屋到故人旧事，鲁迅以成年后的目光重看童年和青年时期的生活。', 'dawn-blossoms'],
    ['城南旧事', '林海音', '借小女孩英子的眼睛看老北京的人和街巷，写相逢，也写童年里那些当时还不懂的告别。', 'memories-of-peking'],
    ['看不见的城市', '伊塔洛·卡尔维诺', '马可·波罗向忽必烈讲述一座座想象中的城市。每篇都很短，却会改变你观察真实城市的方式。', 'invisible-cities'],
  ] },
  { id: 'seasons', type: 'nature', category: '自然写作', title: '湖畔四季观察簿', intro: '沿同一条小路走过四季，看看每次会遇到什么。', books: [
    ['沙乡年鉴', '奥尔多·利奥波德', '按月份记录农场周围的鸟兽、风雪和植物，从一年的细小变化谈到人如何照料土地。', 'sand-county-almanac', '展示版本：《沙郡年记》'],
    ['大自然的日历', '米哈伊尔·普里什文', '顺着物候的变化读森林与原野。读完一小节，不妨到户外找找同样细微的季节信号。', 'natures-calendar'],
    ['所罗门王的指环', '康拉德·洛伦茨', '作者从亲自饲养和观察的动物写起，讲它们怎样交流、做选择，以及人容易怎样误读它们。', 'king-solomons-ring'],
  ] },
  { id: 'poetry', type: 'poetry', category: '诗歌', title: '把日子写成诗', intro: '几行短诗，留给那些不知如何开口的日子。', books: [
    ['飞鸟集', '拉宾德拉纳特·泰戈尔', '以短章写晨昏、自然与相遇，适合每天翻开一页，停在最有共鸣的一两句。', 'stray-birds'],
    ['繁星·春水', '冰心', '两部短诗集写童年、母爱和自然。句子明净，适合第一次读现代汉语短诗的读者。', 'stars-and-spring-water'],
    ['海子诗选', '海子', '从麦地、村庄和远行写起，熟悉的事物在诗里有了不同寻常的重量。可以从短诗读起。', 'haizi-poems'],
  ] },
  { id: 'family', type: 'family', category: '亲子共读', title: '故事从窗边开始', intro: '可以一起读出声的故事，今天读一章就好。', books: [
    ['窗边的小豆豆', '黑柳彻子', '一所用电车当教室的小学，给一个不合常规的孩子留出了好奇和成长的空间。', 'totto-chan'],
    ['夏洛的网', 'E. B. 怀特', '一只蜘蛛用网救下一头小猪。适合共读完一章后，聊聊故事里的承诺、离别和友谊。', 'charlottes-web'],
    ['柳林风声', '肯尼斯·格雷厄姆', '在河岸、乡间和朋友家之间展开的故事。章节有快有慢，适合在睡前轮流读给彼此听。', 'wind-in-the-willows'],
  ] },
];

// Source size, then optional edge trims for product photos with a white backdrop.
const coverFrames = {
  'human-grasses': [428, 616],
  'temple-of-earth': [725, 1051],
  'yashe-essays': [400, 588],
  walden: [320, 500, 19, 28, 1, 44],
  'insect-stories': [393, 500, 23, 21, 21, 41],
  'silent-spring': [656, 974],
  'dawn-blossoms': [815, 1251],
  'memories-of-peking': [400, 500, 55, 25, 60, 57],
  'invisible-cities': [690, 1032],
  'sand-county-almanac': [200, 283],
  'natures-calendar': [1080, 1617],
  'king-solomons-ring': [1080, 1561],
  'stray-birds': [1080, 1858],
  'stars-and-spring-water': [1080, 1545],
  'haizi-poems': [800, 1000, 36, 54, 30, 63],
  'totto-chan': [1080, 1535],
  'charlottes-web': [416, 568],
  'wind-in-the-willows': [415, 541],
};

const main = document.querySelector('main');
const links = document.querySelectorAll('[data-page]');
const languageToggle = document.querySelector('#language-toggle');
const monthLabel = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const periodStart = Date.UTC(2026, 10, 19);
let filters = { query: '', period: '60' };
let suggestionResult = null;

function eventTime(event) {
  const value = `${event.date}T${event.time}:00+08:00`;
  return `<time datetime="${value}">${formatDate(value)}</time>`;
}

function eventPoster(event) {
  return `<div class="poster theme-${event.type}" aria-hidden="true">
    <span class="poster-title">${language === 'en' ? event.poster : event.posterZh}</span>
    <div class="poster-art"><i></i><i></i><i></i></div>
    <div class="poster-date"><strong>${event.date.slice(-2)}</strong><span>${language === 'en' ? monthLabel.format(new Date(event.date)) : `${Number(event.date.slice(5, 7))}月`}</span></div>
  </div>`;
}

function eventCard(event) {
  return `<article class="card">
    <a class="card-media" href="#events/${event.id}" lang="zh-CN" aria-label="${event.title}">${eventPoster(event)}</a>
    <div class="card-body">
      <p class="category" lang="zh-CN">${event.category}</p>
      <h3 lang="zh-CN"><a href="#events/${event.id}">${event.title}</a></h3>
      <p class="event-meta">${eventTime(event)}<span>${t('天镜湖店 · 阅读空间')}</span></p>
      <div class="card-foot"><span>${t('余 {remaining} 席 / 共 {places} 席', event)}</span><a class="text-link" href="#events/${event.id}">${t('了解活动')}</a></div>
    </div>
  </article>`;
}

function cover([title, , , id]) {
  const [width, height, left = 0, top = 0, right = 0, bottom = 0] = coverFrames[id];
  const framedWidth = width - left - right;
  const framedHeight = height - top - bottom;
  const frame = `--cover-ratio:${framedWidth / framedHeight};--image-width:${width / framedWidth * 100}%;--image-x:${-left / framedWidth * 100}%;--image-y:${-top / framedHeight * 100}%`;
  return `<span class="book-frame" style="${frame}"><img class="book" src="covers/${id}.jpg" alt="" data-book-title="${title}"></span>`;
}

function displayShelf(shelf) {
  return `<div class="shelf-display theme-${shelf.type}" aria-hidden="true"><div class="shelf-backing"></div><div class="book-row">${shelf.books.map(cover).join('')}</div></div>`;
}

function shelfCard(shelf) {
  return `<article class="card">
    <a class="card-media" href="#bookshelf/${shelf.id}" lang="zh-CN" aria-label="${shelf.title}">${displayShelf(shelf)}</a>
    <div class="card-body">
      <p class="category">${t(shelf.category)}</p>
      <h3 lang="zh-CN"><a href="#bookshelf/${shelf.id}">${shelf.title}</a></h3>
      <p class="card-copy">${t(shelf.intro)}</p>
      <div class="card-foot"><span>${t('{count} 本书', { count: shelf.books.length })}</span><a class="text-link" href="#bookshelf/${shelf.id}">${t('浏览书架')}</a></div>
    </div>
  </article>`;
}

function pageTitle(label, title, subtitle) {
  return `<div class="page-title"><p class="eyebrow">${label}</p><h1>${title}</h1><p>${subtitle}</p></div>`;
}

function home() {
  return `<section class="hero">
      <div class="wrap hero-content">
        <p class="eyebrow">${t('三联书店')} <span>&middot;</span> ${t('天镜湖店')}</p>
        <h1>${t('以书为邻，')}<br>${t('与美好相遇。')}</h1>
        <p>${t('在湖畔留一点时间给阅读。一本好书，一场对话，一群有趣的人。')}</p>
        <a class="button button-light" href="#events">${t('寻找下一场相遇')}</a>
      </div>
    </section>
    <section class="wrap listing" aria-labelledby="home-events">
      <div class="section-heading"><div><p class="eyebrow">${t('湖畔阅读空间')}</p><h2 id="home-events">${t('让思想，在这里交汇')}</h2></div><a class="text-link" href="#events">${t('全部活动')}</a></div>
      <div class="grid">${events.slice(0, 3).map(eventCard).join('')}</div>
    </section>
    <section class="shelf-band"><div class="wrap listing" aria-labelledby="home-shelves">
      <div class="section-heading"><div><p class="eyebrow">${t('字里行间')}</p><h2 id="home-shelves">${t('从书架选一本')}</h2></div><a class="text-link" href="#bookshelf">${t('全部书架')}</a></div>
      <div class="grid">${shelves.slice(0, 3).map(shelfCard).join('')}</div>
    </div></section>`;
}

function showEventResults() {
  const query = filters.query.trim().toLowerCase();
  const until = periodStart + Number(filters.period) * 86400000;
  const results = events.filter(event => {
    const date = Date.parse(event.date);
    return date > periodStart && date <= until &&
      `${event.title} ${event.category} ${event.poster.replace('\n', ' ')} ${event.posterZh.replace('\n', '')}`.toLowerCase().includes(query);
  });
  document.querySelector('#result-count').textContent = results.length === 1 ? t('1 场活动') : t('{count} 场活动', { count: results.length });
  document.querySelector('#event-results').innerHTML = results.length
    ? results.map(eventCard).join('')
    : `<p class="empty">${t('没有匹配的活动。试试其他关键词或更长的时间范围。')}</p>`;
}

function eventsPage() {
  return `<div class="wrap page">
    ${pageTitle(t('湖畔阅读空间'), t('文化活动'), t('为喜欢的主题，留一个位置。'))}
    <form class="event-filter" id="event-filter" role="search" aria-label="${t('搜索活动')}">
      <label>${t('关键词')} <input name="query" type="search" placeholder="${t('搜索活动')}"></label>
      <label>${t('时间范围')} <select name="period">${[7, 30, 60].map(days => `<option value="${days}">${t('未来 {days} 天', { days })}</option>`).join('')}</select></label>
      <button class="button" type="submit">${t('搜索')}</button>
    </form>
    <p class="result-count" id="result-count" aria-live="polite"></p>
    <div class="grid" id="event-results"></div>
  </div>`;
}

function eventDetail(event) {
  return `<div class="wrap page detail-page">
    <a class="text-link back-link" href="#events">${t('返回文化活动')}</a>
    <article class="detail">
      ${eventPoster(event)}
      <div class="detail-body">
        <p class="category" lang="zh-CN">${event.category}</p>
        <h1 lang="zh-CN">${event.title}</h1>
        <dl class="event-facts">
          <div><dt>${t('时间')}</dt><dd>${eventTime(event)}</dd></div>
          <div><dt>${t('地点')}</dt><dd>${t('天镜湖店 · 阅读空间')}</dd></div>
          <div><dt>${t('费用')}</dt><dd>${t('免费')} &middot; ${t('余 {remaining} 席 / 共 {places} 席', event)}</dd></div>
        </dl>
        <p class="event-intro" lang="zh-CN">${event.intro}</p>
        <p class="preview-note">${t('示例活动 · 本地预览不开放报名。')}</p>
      </div>
    </article>
  </div>`;
}

function bookshelf() {
  return `<div class="wrap page bookshelf-page">
    ${pageTitle(t('字里行间'), t('书架漫游'), t('在三联书架上，找到下一本想读的书。'))}
    <div class="grid">${shelves.map(shelfCard).join('')}</div>
  </div>`;
}

function shelfDetail(shelf) {
  return `<div class="wrap page detail-page">
    <a class="text-link back-link" href="#bookshelf">${t('返回书架漫游')}</a>
    <article class="detail">
      ${displayShelf(shelf)}
      <div class="detail-body">
        <p class="category">${t(shelf.category)}</p>
        <h1 lang="zh-CN">${shelf.title}</h1>
        <p>${t(shelf.intro)}</p>
        <h2 class="recommendation-title">${t('本架推荐')}</h2>
        <ol class="book-list">${shelf.books.map(book => `<li>${cover(book)}<div>
          <div lang="zh-CN"><h3>${book[0]}</h3><p class="book-author">${book[1]}</p><p>${book[2]}</p></div>
          ${book[4] ? `<p class="book-edition">${t(book[4])}</p>` : ''}
        </div></li>`).join('')}</ol>
      </div>
    </article>
  </div>`;
}

function readers() {
  return `<div class="wrap page corner-page">
    ${pageTitle(t('给书店的一封信'), t('读者一隅'), t('给天镜湖店留下一点想法。'))}
    <section class="notebook" aria-labelledby="suggestion-title">
      <div class="notebook-heading"><span class="category">${t('门店建议')}</span><h2 id="suggestion-title">${t('写给三联')}</h2></div>
      <form id="suggestion-form" class="suggestion-form">
        <label>${t('主题')} <select name="topic">${['阅读空间', '活动', '书目推荐', '其他'].map(topic => `<option value="${topic}">${t(topic)}</option>`).join('')}</select></label>
        <label>${t('你的建议')} <textarea name="suggestion" rows="5" maxlength="500" required placeholder="${t('你想让书店知道些什么？')}"></textarea></label>
        <div class="suggestion-actions"><button class="button" type="submit">${t('预览建议')}</button><p id="suggestion-status" role="status"></p></div>
        <div id="suggestion-preview" class="suggestion-preview" hidden><h3 id="suggestion-topic"></h3><p id="suggestion-text"></p></div>
      </form>
    </section>
  </div>`;
}

function showSuggestionResult() {
  if (!suggestionResult) return;
  const { topic, text } = suggestionResult;
  document.querySelector('#suggestion-status').textContent = t(text ? '仅供预览，未发送给门店。' : '请输入建议。');
  document.querySelector('#suggestion-preview').hidden = !text;
  if (text) {
    document.querySelector('#suggestion-topic').textContent = t(topic);
    document.querySelector('#suggestion-text').textContent = text;
  }
}

function render(focus = false, keepScroll = false) {
  const [page, id] = location.hash.slice(1).split('/');
  const current = ['events', 'bookshelf', 'readers'].includes(page) ? page : 'home';
  const detail = (current === 'events' ? events : current === 'bookshelf' ? shelves : []).find(item => item.id === id);
  links.forEach(link => {
    if (link.dataset.page === current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (current === 'events') {
    main.innerHTML = detail ? eventDetail(detail) : eventsPage();
    if (!detail) {
      const form = document.querySelector('#event-filter');
      form.elements.query.value = filters.query;
      form.elements.period.value = filters.period;
      showEventResults();
    }
  } else if (current === 'bookshelf') {
    main.innerHTML = detail ? shelfDetail(detail) : bookshelf();
  } else {
    main.innerHTML = current === 'readers' ? readers() : home();
    if (current === 'readers') showSuggestionResult();
  }
  document.title = `${detail?.title || t({ home: '天镜湖店', events: '文化活动', bookshelf: '书架漫游', readers: '读者一隅' }[current])} | Sanlian Connect`;
  if (!keepScroll) window.scrollTo(0, 0);
  if (focus) main.focus({ preventScroll: true });
}

main.addEventListener('submit', event => {
  const form = event.target;
  event.preventDefault();
  if (form.id === 'event-filter') {
    filters = Object.fromEntries(new FormData(form));
    showEventResults();
  } else if (form.id === 'suggestion-form') {
    const { topic, suggestion } = Object.fromEntries(new FormData(form));
    suggestionResult = { topic, text: suggestion.trim() };
    showSuggestionResult();
    if (!suggestionResult.text) form.elements.suggestion.focus();
  }
});

document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
function renderLanguage() {
  document.documentElement.lang = language;
  languageToggle.textContent = language === 'en' ? '中文' : 'English';
  languageToggle.lang = language === 'en' ? 'zh-CN' : 'en';
  localize(document);
}

languageToggle.addEventListener('click', () => {
  const form = main.querySelector('form');
  const draft = form && new FormData(form);
  const scroll = window.scrollY;
  setLanguage(language === 'en' ? 'zh-CN' : 'en');
  renderLanguage();
  render(false, true);
  if (draft) {
    const fields = document.getElementById(form.id).elements;
    for (const [name, value] of draft) fields.namedItem(name).value = value;
  }
  window.scrollTo(0, scroll);
});
window.addEventListener('hashchange', () => {
  suggestionResult = null;
  render(true);
});
renderLanguage();
render();
