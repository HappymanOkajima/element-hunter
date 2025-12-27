import type { EnemyConfig, EnemyType } from '../types';

// HTML要素の敵定義（MVP用に3種のみ）
export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  p: {
    tag: 'p',
    displayName: '<p>',
    rarity: 1,
    color: '#FFFFFF',
    hp: 1,
    damage: 1,
    speed: 60,
    behavior: 'patrol',
  },
  div: {
    tag: 'div',
    displayName: '<div>',
    rarity: 1,
    color: '#FFFFFF',
    hp: 2,
    damage: 1,
    speed: 50,
    behavior: 'orbit',
  },
  h1: {
    tag: 'h1',
    displayName: '<h1>',
    rarity: 3,
    color: '#0088FF',
    hp: 7,
    damage: 4,
    speed: 30,
    behavior: 'chase',
  },
};

// レアリティに対応する色
export const RARITY_COLORS: Record<number, string> = {
  1: '#FFFFFF',  // 白
  2: '#00FF00',  // 緑
  3: '#0088FF',  // 青
  4: '#AA00FF',  // 紫
  5: '#FFD700',  // 金
};
