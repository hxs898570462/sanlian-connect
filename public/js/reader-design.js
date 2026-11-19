import {t,getLanguage} from './i18n.js';

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

const posterStyles=[
  [/亲子|家庭|儿童|family|children/i,'family','亲子\n共读'],
  [/诗|poetry/i,'poetry','围坐\n读诗'],
  [/自然|博物|科学|nature|science/i,'nature','自然\n手记'],
  [/文学|沙龙|literature|salon/i,'salon','文学\n沙龙'],
  [/读书|共读|book\s*(club|swap)|reading/i,'club','一起\n读书']
];
const posterDates=Object.fromEntries(['zh-CN','en'].map(language=>[language,
  new Intl.DateTimeFormat(language,{timeZone:'Asia/Shanghai',day:'2-digit',month:language==='en'?'short':'numeric'})
]));

export function eventPoster(activity){
  const [,theme,title]=posterStyles.find(([pattern])=>pattern.test(activity.category))||[null,'club','湖畔\n活动'];
  const language=getLanguage();
  const parts=posterDates[language].formatToParts(new Date(activity.start_time));
  const day=parts.find(part=>part.type==='day').value;
  const month=parts.find(part=>part.type==='month').value;
  return `<div class="reader-poster reader-theme-${theme}" aria-hidden="true">
    <span class="reader-poster-title">${t(title)}</span>
    <span class="reader-poster-art"><i></i><i></i><i></i></span>
    <span class="reader-poster-date"><strong>${day}</strong><span>${month}${language==='zh-CN'?'月':''}</span></span>
  </div>`;
}

function cover([,,,id]){
  const [width,height,left=0,top=0,right=0,bottom=0]=coverFrames[id];
  const framedWidth=width-left-right,framedHeight=height-top-bottom;
  const style=`--cover-ratio:${framedWidth/framedHeight};--image-width:${width/framedWidth*100}%;--image-x:${-left/framedWidth*100}%;--image-y:${-top/framedHeight*100}%`;
  return `<span class="reader-cover-frame" style="${style}"><img class="reader-cover" src="/assets/reader/covers/${id}.jpg" alt="" loading="lazy"></span>`;
}
function shelfDisplay(shelf){
  return `<div class="reader-shelf reader-theme-${shelf.type}" aria-hidden="true"><div class="reader-shelf-back"></div><div class="reader-book-row">${shelf.books.map(cover).join('')}</div></div>`;
}
export function shelfCards(limit=shelves.length){
  return shelves.slice(0,limit).map(shelf=>`<article class="card reader-shelf-card">
    <a class="reader-card-media" href="#shelf/${shelf.id}" aria-label="${t('查看{title}',{title:shelf.title})}">${shelfDisplay(shelf)}</a>
    <div class="card-body"><span class="reader-category">${t(shelf.category)}</span>
      <h3><a href="#shelf/${shelf.id}" lang="zh-CN">${shelf.title}</a></h3>
      <p>${t(shelf.intro)}</p>
      <div class="card-foot"><span>${t('{count} 本书',{count:shelf.books.length})}</span><a class="text-link" href="#shelf/${shelf.id}">${t('浏览书架')}</a></div>
    </div>
  </article>`).join('');
}
export function shelfDetail(id){
  const shelf=shelves.find(item=>item.id===id);
  const back=`<a class="back" href="#books">${t('← 返回书架漫游')}</a>`;
  if(!shelf)return `${back}<h1>${t('书架不存在')}</h1>`;
  return `${back}<article class="reader-shelf-detail">${shelfDisplay(shelf)}
    <span class="reader-category">${t(shelf.category)}</span><h1 lang="zh-CN">${shelf.title}</h1><p>${t(shelf.intro)}</p>
    <h2>${t('本架推荐')}</h2>
    <ul class="reader-recommendations">${shelf.books.map(book=>`<li>${cover(book)}<div>
      <div lang="zh-CN"><h3>${book[0]}</h3><p class="reader-category">${book[1]}</p><p>${book[2]}</p></div>
      ${book[4]?`<p class="small">${t(book[4])}</p>`:''}
    </div></li>`).join('')}</ul>
  </article>`;
}
