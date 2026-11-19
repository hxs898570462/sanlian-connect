const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const screenshots = path.join(require('node:os').tmpdir(), 'sanlian-reader-design-preview');
  fs.mkdirSync(screenshots, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const url = pathToFileURL(path.join(__dirname, 'index.html')).href;
    const errors = [];
    const outbound = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/^https?:/.test(request.url())) outbound.push(request.url());
    });
    const nav = page.getByRole('navigation');
    const go = async label => {
      await nav.getByRole('link', { name: label, exact: true }).click();
      await nav.locator('[aria-current="page"]').filter({ hasText: label }).waitFor();
    };
    const capture = (filename, fullPage = false) => page.screenshot({ path: path.join(screenshots, filename), fullPage });
    const fit = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, page.url());
    const readCovers = locator => locator.evaluateAll(async images => Promise.all(images.map(async image => {
      await image.decode();
      if (image.naturalWidth < 100 || image.naturalHeight < 140) throw new Error(`Incomplete cover: ${image.src}`);
      return { title: image.dataset.bookTitle, path: image.getAttribute('src') };
    })));
    const verifyShelfRows = async (expected = 6) => {
      const rows = await page.locator('.book-row').evaluateAll(rows => rows.map(row => {
        const bounds = row.getBoundingClientRect();
        const books = Array.from(row.children, frame => {
          const rect = frame.getBoundingClientRect();
          const imageWidth = frame.firstElementChild.getBoundingClientRect().width;
          const sourceScale = parseFloat(frame.style.getPropertyValue('--image-width')) / 100;
          const visible = rect.width / (imageWidth / sourceScale);
          const previous = frame.previousElementSibling;
          if (rect.left < bounds.left || rect.right > bounds.right || Math.abs(rect.bottom - bounds.bottom) >= 1) return false;
          if (Math.abs(visible - 1) >= .01) return false;
          if (!previous) return true;
          const previousRight = previous.getBoundingClientRect().right;
          const overlap = (previousRight - rect.left) / rect.width;
          return overlap > .40 && overlap < .48 &&
            Number(getComputedStyle(previous).zIndex) > (Number(getComputedStyle(frame).zIndex) || 0);
        });
        return books.length === 3 && books.every(Boolean);
      }));
      assert.equal(rows.length, expected);
      assert.ok(rows.every(Boolean), 'Each shelf should stack full covers with a shared baseline');
    };
    const switchLanguage = async (label, locale) => {
      const urlBefore = page.url();
      await page.getByRole('button', { name: label, exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('lang'), locale);
      assert.equal(await page.evaluate(() => localStorage.getItem('sanlian-language')), locale);
      assert.equal(page.url(), urlBefore);
    };
    await page.goto(url);
    await page.getByRole('heading', { level: 1, name: /以书为邻/ }).waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
    await switchLanguage('English', 'en');
    await page.reload();
    await page.getByRole('heading', { level: 1, name: /A place for books/ }).waitFor();
    assert.equal(await page.evaluate(async () => {
      const image = new Image();
      image.src = 'reading-room.jpg';
      await image.decode();
      return image.naturalWidth > 1000;
    }), true);
    await fit();
    await verifyShelfRows(3);
    await capture('home-desktop.png');
    await page.getByRole('link', { name: 'Find your next event' }).click();
    const count = page.locator('#result-count');
    assert.equal(await count.textContent(), '6 events');
    await capture('events-desktop.png');
    await page.getByLabel('Date range').selectOption('7');
    await page.getByRole('button', { name: 'Search' }).click();
    assert.equal(await count.textContent(), '2 events');
    await page.getByLabel('Keyword').fill('city');
    await page.getByRole('button', { name: 'Search' }).click();
    assert.equal(await count.textContent(), '1 event');
    await page.getByLabel('Keyword').fill('City walk');
    await switchLanguage('中文', 'zh-CN');
    assert.equal(await page.getByLabel('关键词').inputValue(), 'City walk');
    assert.equal(await page.getByLabel('时间范围').inputValue(), '7');
    assert.equal(await count.textContent(), '1 场活动');
    await switchLanguage('English', 'en');
    await page.getByRole('link', { name: 'View event' }).click();
    await page.getByRole('heading', { level: 1, name: '一本书里的城市漫游' }).waitFor();
    await page.getByRole('link', { name: 'Back to events' }).click();
    assert.equal(await count.textContent(), '1 event');
    await page.getByLabel('Keyword').fill('no match');
    await page.getByRole('button', { name: 'Search' }).click();
    assert.equal(await page.locator('.empty').isVisible(), true);

    await go('Bookshelf');
    assert.equal(await page.locator('.card').count(), 6);
    const allCovers = await readCovers(page.locator('.card img.book'));
    assert.equal(new Set(allCovers.map(cover => cover.path)).size, 18);
    await switchLanguage('中文', 'zh-CN');
    await page.getByRole('heading', { level: 1, name: '书架漫游' }).waitFor();
    assert.deepEqual(await readCovers(page.locator('.card img.book')), allCovers);
    await fit();
    await verifyShelfRows();
    await capture('bookshelf-desktop-zh.png', true);
    await switchLanguage('English', 'en');
    await capture('bookshelf-desktop.png');
    for (let index = 0; index < 6; index++) {
      const card = page.locator('.card').nth(index);
      await card.waitFor();
      const covers = await readCovers(card.locator('img.book'));
      await card.getByRole('link', { name: 'Browse shelf' }).click();
      await page.locator('.book-list').waitFor();
      await verifyShelfRows(1);
      assert.equal(covers.length, 3);
      assert.deepEqual(await page.locator('.book-list h3').allTextContents(), covers.map(cover => cover.title));
      assert.deepEqual(await readCovers(page.locator('.book-list img.book')), covers);
      if (!index) {
        await capture('shelf-detail-desktop.png');
        await switchLanguage('中文', 'zh-CN');
        await page.getByRole('heading', { name: '本架推荐' }).waitFor();
        assert.deepEqual(await readCovers(page.locator('.book-list img.book')), covers);
        await switchLanguage('English', 'en');
      }
      await page.getByRole('link', { name: 'Back to the bookshelf' }).click();
    }

    await go('Reader’s Corner');
    await page.getByLabel('Topic').selectOption({ label: 'Events' });
    await page.getByLabel('Your suggestion').fill('<b>More poetry evenings</b>');
    await switchLanguage('中文', 'zh-CN');
    assert.equal(await page.getByLabel('主题').inputValue(), '活动');
    assert.equal(await page.getByLabel('你的建议').inputValue(), '<b>More poetry evenings</b>');
    await switchLanguage('English', 'en');
    await page.getByRole('button', { name: 'Preview suggestion' }).click();
    assert.equal(await page.locator('#suggestion-text').textContent(), '<b>More poetry evenings</b>');
    assert.equal(await page.locator('#suggestion-text b').count(), 0);
    assert.match(await page.locator('#suggestion-status').textContent(), /Nothing was sent/);
    await switchLanguage('中文', 'zh-CN');
    assert.equal(await page.locator('#suggestion-topic').textContent(), '活动');
    assert.match(await page.locator('#suggestion-status').textContent(), /未发送/);
    await switchLanguage('English', 'en');
    await capture('readers-desktop.png');

    for (const width of [390, 320, 801]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [route, screenshot, title] of [
        ['home', 'home', /A place for books/], ['events', 'events', 'Events'],
        ['events/nature-book', 'event-detail', '把自然写进一本小书'],
        ['bookshelf', 'bookshelf', 'Bookshelf'], ['bookshelf/everyday', 'shelf-detail', '阅读与日常'],
        ['readers', 'readers', 'Reader’s Corner'],
      ]) {
        await page.goto(`${url}#${route}`);
        await page.getByRole('heading', { level: 1, name: title }).waitFor();
        await fit();
        if (route === 'bookshelf') await verifyShelfRows();
        if (width === 390) await capture(`${screenshot}-mobile.png`);
      }
    }
    await switchLanguage('中文', 'zh-CN');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [route, title] of [['home', /以书为邻/], ['events', '文化活动'], ['bookshelf', '书架漫游'], ['bookshelf/seasons', '湖畔四季观察簿'], ['readers', '读者一隅']]) {
        await page.goto(`${url}#${route}`);
        await page.getByRole('heading', { level: 1, name: title }).waitFor();
        await fit();
        if (route === 'bookshelf') {
          await verifyShelfRows();
          if (width === 390) await capture('bookshelf-mobile-zh.png');
        }
      }
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(outbound, []);
    console.log('Verified 18 local covers, 6 matching shelf details, bilingual UI and preference, retained filters and drafts, and desktop/mobile layouts.');
  } finally {
    await browser.close();
  }
}

verify().catch(error => { console.error(error); process.exitCode = 1; });
