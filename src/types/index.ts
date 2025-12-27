// ゲーム全体で使用する型定義

export type Direction = 'up' | 'down' | 'left' | 'right' |
                        'up-left' | 'up-right' | 'down-left' | 'down-right';

export type EnemyType = 'p' | 'div' | 'h1';

export type EnemyBehavior = 'patrol' | 'orbit' | 'chase';

export interface EnemyConfig {
  tag: string;
  displayName: string;
  rarity: number;
  color: string;
  hp: number;
  damage: number;
  speed: number;
  behavior: EnemyBehavior;
}

export interface EnemySpawn {
  type: EnemyType;
  x: number;
  y: number;
}

export interface StageConfig {
  enemies: EnemySpawn[];
  goalX: number;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  isAttacking: boolean;
  direction: Direction;
}
