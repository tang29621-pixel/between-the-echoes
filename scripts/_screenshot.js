// 截图脚本：依次截图所有 11 个章节 + 物品详情 + 海边
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:/Users/Administrator/AppData/Local/Temp/screenshots';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const CHAPTER_NUM = {
  'home': 1, 'intro': 2, 'video-a': 3, 'archive': 4, 'ai-prompt': 5,
  'video-b': 6, 'sea': 7, 'video-c': 8, 'write': 9, 'confirm': 10, 'end': 11
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  // 拦截视频播放（headless 下不影响截图）
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function() { return Promise.resolve(); };
  });

  console.log('Opening page...');
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const chapters = ['home', 'intro', 'video-a', 'archive', 'ai-prompt',
    'video-b', 'sea', 'video-c', 'write', 'confirm', 'end'];

  for (let i = 0; i < chapters.length; i++) {
    const id = chapters[i];
    const num = String(i + 1).padStart(2, '0');
    const filename = `${num}-${id}.png`;
    const chapterNum = CHAPTER_NUM[id];

    await page.evaluate((chapterNum) => {
      // 隐藏所有章节
      document.querySelectorAll('.chapter').forEach(c => {
        c.classList.remove('is-active');
        c.hidden = true;
      });
      // 显示目标章节
      const target = document.getElementById('chapter-' + chapterNum);
      if (target) {
        target.hidden = false;
        void target.offsetWidth;
        target.classList.add('is-active');
      }
      // 显示 video 章节的结束卡（用于截图占位状态）
      document.querySelectorAll('.video__end').forEach(e => {
        e.classList.add('is-active');
      });
      // 写一封信默认就有 placeholder
    }, chapterNum);

    await page.waitForTimeout(2200); // 等动画

    const outPath = path.join(OUT_DIR, filename);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  ✓ ${filename}`);
  }

  // 物品详情浮层
  console.log('Item detail...');
  await page.evaluate(() => {
    document.querySelectorAll('.chapter').forEach(c => {
      c.classList.remove('is-active');
      c.hidden = true;
    });
    const archive = document.getElementById('chapter-4');
    archive.hidden = false;
    void archive.offsetWidth;
    archive.classList.add('is-active');
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    if (window.Echo && window.Echo.ItemDetail) {
      window.Echo.ItemDetail.open('painting');
    }
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '12-item-detail.png') });
  console.log('  ✓ 12-item-detail.png');

  // 海边探索
  console.log('Sea explore...');
  await page.evaluate(() => {
    if (window.Echo && window.Echo.ItemDetail) window.Echo.ItemDetail.close();
    document.querySelectorAll('.chapter').forEach(c => {
      c.classList.remove('is-active');
      c.hidden = true;
    });
    const sea = document.getElementById('chapter-7');
    sea.hidden = false;
    void sea.offsetWidth;
    sea.classList.add('is-active');
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '13-sea-explore.png') });
  console.log('  ✓ 13-sea-explore.png');

  await browser.close();
  console.log('All done!');
})();
