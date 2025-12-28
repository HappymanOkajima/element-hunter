import type { EnemyConfig, EnemyBehavior } from '../types';

// レアリティに対応する色
export const RARITY_COLORS: Record<number, string> = {
  1: '#FFFFFF',  // 白
  2: '#00FF00',  // 緑
  3: '#0088FF',  // 青
  4: '#AA00FF',  // 紫
  5: '#FFD700',  // 金
};

// レアリティに対応するHP範囲
const RARITY_HP: Record<number, [number, number]> = {
  1: [1, 2],
  2: [3, 5],
  3: [5, 10],
  4: [8, 15],
  5: [15, 25],
};

// レアリティに対応するダメージ
const RARITY_DAMAGE: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};

// レアリティに対応する速度
const RARITY_SPEED: Record<number, number> = {
  1: 60,
  2: 50,
  3: 40,
  4: 35,
  5: 30,
};

// レアリティに対応するサイズ（フォントサイズ）
const RARITY_SIZE: Record<number, number> = {
  1: 14,   // 小さい
  2: 16,   // 標準
  3: 20,   // やや大きい
  4: 24,   // 大きい
  5: 28,   // 最大
};

// タグの基本レアリティ
const TAG_RARITY: Record<string, number> = {
  // ★1 (白) - 一般的な要素
  'p': 1, 'span': 1, 'div': 1, 'a': 1, 'li': 1, 'img': 1,
  'ul': 1, 'ol': 1, 'br': 1, 'hr': 1, 'em': 1, 'strong': 1,
  'b': 1, 'i': 1, 'u': 1, 'small': 1, 'sub': 1, 'sup': 1,

  // ★2 (緑) - フォーム・テーブル関連
  'h6': 2, 'h5': 2, 'h4': 2, 'table': 2, 'form': 2, 'button': 2,
  'input': 2, 'select': 2, 'textarea': 2, 'label': 2, 'tr': 2, 'td': 2,
  'th': 2, 'thead': 2, 'tbody': 2, 'tfoot': 2, 'fieldset': 2, 'legend': 2,
  'option': 2, 'optgroup': 2,

  // ★3 (青) - セマンティック・メディア要素
  'h3': 3, 'h2': 3, 'h1': 3, 'article': 3, 'section': 3,
  'video': 3, 'audio': 3, 'canvas': 3, 'iframe': 3, 'nav': 3, 'aside': 3,
  'header': 3, 'footer': 3, 'main': 3, 'figure': 3, 'figcaption': 3,
  'blockquote': 3, 'pre': 3, 'code': 3,

  // ★4 (紫) - 特殊要素
  'dialog': 4, 'template': 4, 'details': 4, 'meter': 4,
  'progress': 4, 'svg': 4, 'picture': 4, 'mark': 4, 'summary': 4,
  'time': 4, 'address': 4, 'abbr': 4, 'cite': 4, 'dfn': 4,
  'kbd': 4, 'samp': 4, 'var': 4,

  // ★5 (金) - 希少要素
  'ruby': 5, 'rt': 5, 'rp': 5, 'bdo': 5, 'bdi': 5, 'wbr': 5,
  'data': 5, 'slot': 5, 'output': 5, 'math': 5, 'object': 5,
  'embed': 5, 'map': 5, 'area': 5, 'track': 5, 'source': 5,
  'datalist': 5, 'keygen': 5, 'menuitem': 5,
};

// 行動パターンの割り当て
const TAG_BEHAVIOR: Record<string, EnemyBehavior> = {
  // 往復: テキスト系
  'p': 'patrol', 'span': 'patrol', 'a': 'patrol', 'li': 'patrol',
  'em': 'patrol', 'strong': 'patrol', 'b': 'patrol', 'i': 'patrol',
  'small': 'patrol', 'blockquote': 'patrol', 'pre': 'patrol', 'code': 'patrol',

  // 巡回: 構造系
  'div': 'orbit', 'section': 'orbit', 'article': 'orbit', 'aside': 'orbit',
  'nav': 'orbit', 'header': 'orbit', 'footer': 'orbit', 'main': 'orbit',
  'table': 'orbit', 'form': 'orbit', 'fieldset': 'orbit', 'figure': 'orbit',
  'ul': 'orbit', 'ol': 'orbit',

  // 追尾: 見出し・メディア・特殊
  'h1': 'chase', 'h2': 'chase', 'h3': 'chase', 'h4': 'chase', 'h5': 'chase', 'h6': 'chase',
  'img': 'chase', 'video': 'chase', 'audio': 'chase', 'canvas': 'chase', 'iframe': 'chase',
  'svg': 'chase', 'button': 'chase', 'input': 'chase',
};

// 除外するタグ（ゲームに出さない）
const EXCLUDED_TAGS = new Set([
  'html', 'head', 'body', 'title', 'meta', 'link', 'script', 'style', 'noscript',
  'base', 'col', 'colgroup', 'param', 'source', 'track', 'wbr',
]);

// タグから敵の設定を生成
export function getEnemyConfig(tag: string, statRarity?: number): EnemyConfig | null {
  const normalizedTag = tag.toLowerCase();

  // 除外タグはnullを返す
  if (EXCLUDED_TAGS.has(normalizedTag)) {
    return null;
  }

  // レアリティを決定（statsから取得 or デフォルト）
  const rarity = statRarity || TAG_RARITY[normalizedTag] || 1;

  // HP範囲からランダムに決定
  const hpRange = RARITY_HP[rarity] || RARITY_HP[1];
  const hp = Math.floor(Math.random() * (hpRange[1] - hpRange[0] + 1)) + hpRange[0];

  // 行動パターンを決定
  const behavior = TAG_BEHAVIOR[normalizedTag] || 'patrol';

  return {
    tag: normalizedTag,
    displayName: `<${normalizedTag}>`,
    rarity,
    color: RARITY_COLORS[rarity] || RARITY_COLORS[1],
    hp,
    damage: RARITY_DAMAGE[rarity] || 1,
    speed: RARITY_SPEED[rarity] || 60,
    size: RARITY_SIZE[rarity] || 16,
    behavior,
  };
}

// タグが有効かどうかをチェック
export function isValidEnemyTag(tag: string): boolean {
  return !EXCLUDED_TAGS.has(tag.toLowerCase());
}
