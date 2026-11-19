const english = {
  '跳转至正文': 'Skip to content',
  '主导航': 'Main navigation',
  '首页': 'Home',
  '文化活动': 'Events',
  '书架漫游': 'Bookshelf',
  '读者一隅': 'Reader’s Corner',
  '三联书店': 'Sanlian Books',
  '天镜湖店': 'Tianjing Lake',
  '中国 · 太仓': 'Taicang, China',
  '太仓 · 天镜湖': 'Taicang · Tianjing Lake',
  '设计预览 · 活动为示例': 'Design preview · Sample events',
  '以书为邻，': 'A place for books.',
  '与美好相遇。': 'A place to meet.',
  '在湖畔留一点时间给阅读。一本好书，一场对话，一群有趣的人。': 'Make a little time for reading by the lake. Find a good book, a lively conversation, and people to share them with.',
  '寻找下一场相遇': 'Find your next event',
  '湖畔阅读空间': 'The reading room',
  '天镜湖店 · 阅读空间': 'Tianjing Lake Reading Room',
  '让思想，在这里交汇': 'What’s on at Sanlian',
  '全部活动': 'All events',
  '字里行间': 'Between the pages',
  '从书架选一本': 'From the bookshelf',
  '全部书架': 'All shelves',
  '为喜欢的主题，留一个位置。': 'Find an event worth making time for.',
  '搜索活动': 'Search activities',
  '关键词': 'Keyword',
  '时间范围': 'Date range',
  '未来 {days} 天': 'Next {days} days',
  '搜索': 'Search',
  '{count} 场活动': '{count} events',
  '1 场活动': '1 event',
  '没有匹配的活动。试试其他关键词或更长的时间范围。': 'No events match your search. Try another keyword or a longer date range.',
  '余 {remaining} 席 / 共 {places} 席': '{remaining} of {places} places left',
  '了解活动': 'View event',
  '返回文化活动': 'Back to events',
  '时间': 'When',
  '地点': 'Where',
  '费用': 'Admission',
  '免费': 'Free',
  '示例活动 · 本地预览不开放报名。': 'Sample event · Registration is not available in this preview.',
  '在三联书架上，找到下一本想读的书。': 'Find your next read on the Sanlian bookshelf.',
  '{count} 本书': '{count} books',
  '浏览书架': 'Browse shelf',
  '返回书架漫游': 'Back to the bookshelf',
  '本架推荐': 'On this shelf',
  '展示版本：《沙郡年记》': 'Edition shown: 沙郡年记',
  '给书店的一封信': 'A note to the bookshop',
  '给天镜湖店留下一点想法。': 'Leave a little something for the team at Tianjing Lake.',
  '门店建议': 'Store suggestions',
  '写给三联': 'A note for Sanlian',
  '主题': 'Topic',
  '阅读空间': 'Reading space',
  '活动': 'Events',
  '书目推荐': 'Book recommendations',
  '其他': 'Other',
  '你的建议': 'Your suggestion',
  '你想让书店知道些什么？': 'What would you like the bookshop to know?',
  '预览建议': 'Preview suggestion',
  '请输入建议。': 'Please enter a suggestion.',
  '仅供预览，未发送给门店。': 'Preview only. Nothing was sent to the store.',
  '文学': 'Literature',
  '博物': 'Natural History',
  '城市与地方': 'City & Place',
  '自然写作': 'Nature Writing',
  '诗歌': 'Poetry',
  '亲子共读': 'Family Reading',
  '日常里的细小观察、熟悉的地方和亲近的人。': 'Small observations, familiar places, and the people we call home.',
  '从水边、昆虫和身边的生命开始，重新认识自然。': 'A closer look at water, insects, and the wider living world.',
  '从回忆、想象和街巷出发，以三种方式读一座城。': 'Three ways to read a city: through memory, invention, and the street.',
  '沿同一条小路走过四季，看看每次会遇到什么。': 'Field companions for taking the same walk in different seasons.',
  '几行短诗，留给那些不知如何开口的日子。': 'Short lines for the days that are harder to put into words.',
  '可以一起读出声的故事，今天读一章就好。': 'Stories to read out loud, one chapter at a time.',
};

const storageKey = 'sanlian-language';
let language = 'zh-CN';
try {
  if (localStorage.getItem(storageKey) === 'en') language = 'en';
} catch {}

function t(source, values) {
  const template = language === 'en' && Object.hasOwn(english, source) ? english[source] : source;
  return values ? template.replace(/\{(\w+)\}/g, (part, key) => Object.hasOwn(values, key) ? String(values[key]) : part) : template;
}

function setLanguage(value) {
  language = value === 'en' ? 'en' : 'zh-CN';
  try { localStorage.setItem(storageKey, language); } catch {}
}

function localize(root) {
  for (const node of root.querySelectorAll('[data-copy]')) {
    node.dataset.copy ||= node.textContent;
    node.textContent = t(node.dataset.copy);
  }
  for (const node of root.querySelectorAll('[data-copy-aria-label]')) {
    const attr = 'data-copy-aria-label';
    if (!node.getAttribute(attr)) node.setAttribute(attr, node.getAttribute('aria-label'));
    node.setAttribute('aria-label', t(node.getAttribute(attr)));
  }
}

const dateFormats = Object.fromEntries(['zh-CN', 'en'].map(locale => [locale,
  new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }),
]));

function formatDate(value) {
  return dateFormats[language].format(new Date(value));
}
