// ==========================================
// 1. 数据类型定义（定义数据规则，无需修改）
// ==========================================

export interface BookCover {
  id: string;
  imageUrl: string;    // 必填：图片路径
  title?: string;      // 可选：书名/描述（暂时没有可留空）
  designer?: string;   // 可选：设计师/装帧师
  tags?: string[];     // 可选：标签，如 ['精装', '复古']
}

export interface HighlightGroup {
  id: string;
  bookTitle: string;   // 必填：书名 / 文章标题（一本书只填一次！）
  author?: string;     // 可选：作者名
  quotes: string[];    // 必填：这本书/文章里的所有划线金句列表
}

// ==========================================
// 2. 🎨 书皮视觉阁数据 (Cover Art Collection)
// ==========================================

export const bookCovers: BookCover[] = [
  {
    id: 'c1',
    imageUrl: '/assets/covers/cover1.jpg', //
    title: 'Love Letters of a Musician (1899)',
    designer: 'Myrtle Reed / 镀金圣徒徽章',
    tags: ['维多利亚风格', '布面烫金', '圣徒徽章', '绿调精装']
  },
  {
    id: 'c2',
    imageUrl: '/assets/covers/cover2.jpg',
    title: "Carlotta's Intended (1894)",
    designer: 'B.S. (Art Nouveau Bookbinder)',
    tags: ['新艺术运动', '植物碎花', '田园复古', '金边开窗']
  },
  {
    id: 'c3',
    imageUrl: '/assets/covers/cover3.jpg',
    title: 'Dans la Nuit (1904)',
    designer: 'Charles Levadé / Enoch & Cie',
    tags: ['法式乐谱', '星空夜景', '双色版画', '浪漫主义']
  },
  {
    id: 'c4',
    imageUrl: '/assets/covers/cover4.jpg',
    title: 'Les Elfes des Bois (1920)',
    designer: 'C. Chaminade / L. Fortolis',
    tags: ['森林精灵', '手绘线描', '法式童话', '复古乐谱']
  },
  {
    id: 'c5',
    imageUrl: '/assets/covers/cover5.jpg',
    title: 'Sérénade aux Étoiles (1911)',
    designer: 'C. Chaminade (沙米纳德)',
    tags: ['星空夜曲', '木刻风', '蓝色美学', '沙米纳德']
  }
];

// ==========================================
// 3. ✒️ 电子书高亮数据 (Quotes & Highlights)
// ==========================================

export const highlightGroups: HighlightGroup[] = [
  // 💡 第一本书：一本书摘抄多句话的示范
  {
    id: 'b1',
    bookTitle: '春天是一点一点化开的', // 👈 书名只填一次
    author: '迟子建',           // 👈 作者只填一次
    quotes: [
      '初升的太阳先是把一抹嫣红投给它，接着，嫣红变成橘黄，霜花仿佛被蜜浸透了，让人怀疑蜜蜂看上了这片霜花，把它们辛勤的酿造，洒向这里了。再后来，太阳升得高了，橘黄变成了鹅黄，霜花的颜色就一层层地淡下去、浅下去，成了雪白了，它们离凋零的时辰也就不远了。因为霜花的神经，最怕阳光温暖的触角了。',
      '嫩绿的草芽像绣花针一样顶破丰厚的腐殖土，要以它的妙手，给大地绣出生机时，背阴山坡往往还有残雪呢。这样的残雪，还妄想着做冬的巢穴。',
      '那蜿蜒在林间的一道道春水，被暖风吹拂得起了鱼苗似的波痕。投在水面的阳光，便也跟着起了波痕，好像阳光在水面打起蝴蝶结了。',
      '直到把冰与雪安葬到泥土深处，然后让它们的精魂，又化作自己根芽萌发的雨露。',
      '极北的春天，是一点一点化开的。'
      // 👈 同一本书里还有更多句子，直接在引号里写完，后面加逗号往下加即可
    ]
  },

  // 💡 第二本书/文章示范
  {
    id: 'b2',
    bookTitle: '让-雅克·卢梭传',
    author: '卢梭',
    quotes: [
      '自由不在于做你想做的事，而在于可以不做你不想做的事。',
      '我们的痛苦正是产生于我们的欲望和能力的不平衡。'
    ]
  }
];

// ==========================================
// 4. 🖼️ 全局装饰图片路径配置 (Decorations)
// ==========================================

export const siteDecorations = {
  lilyFlower: '/assets/decorations/lily-flower.png?v=2',       // 左上角水彩百合
  lilyFlowerTransparent: '/assets/decorations/lily-flower-transparent.png', // 透明底百合（浅色背景可用）
  envelopeBottom: '/assets/decorations/envelope-bottom.png?v=2', // 底部信封金色蜡封
  books: '/assets/decorations/books.png',                       // 首页信封上方书册装饰
  babysBreath: `/assets/decorations/${encodeURIComponent('满天星淡雅水彩透明背景图.png')}`, // About 左下满天星
};
