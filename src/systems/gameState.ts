import type { CrawlPage, EnemySnapshot, PageState } from '../types';

// ゲーム状態管理クラス
export class GameState {
  // ターゲットページ（クリアすべきページのパス）
  private targetPages: string[] = [];

  // クリア済みページ
  private clearedPages: Set<string> = new Set();

  // ゲーム開始時刻
  private startTime: number = 0;

  // ページ遷移履歴（戻る機能用）
  private pageHistory: string[] = [];

  // ページごとの敵状態
  private pageStates: Map<string, PageState> = new Map();

  // 現在のページパス
  private currentPagePath: string = '/';

  // ターゲットページをランダム選択（到達可能なページのみ）
  selectTargetPages(allPages: CrawlPage[], count: number = 5, commonLinks: string[] = []): void {
    // 到達可能なページを探索（トップページから辿れるページ）
    const reachable = this.findReachablePages(allPages, commonLinks);

    // トップページ以外をフィルタ
    const candidates = allPages.filter(p => p.path !== '/' && reachable.has(p.path));

    // シャッフル
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);

    // 指定数を選択
    this.targetPages = shuffled.slice(0, count).map(p => p.path);

    // 状態リセット
    this.clearedPages.clear();
    this.pageHistory = [];
    this.pageStates.clear();
    this.startTime = Date.now();
  }

  // トップページから到達可能なページを探索（BFS）
  // commonLinksはナビゲーションメニューなど、どのページからでもアクセス可能なリンク
  private findReachablePages(allPages: CrawlPage[], commonLinks: string[] = []): Set<string> {
    const reachable = new Set<string>();
    const pageMap = new Map(allPages.map(p => [p.path, p]));
    const queue: string[] = ['/'];

    reachable.add('/');

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const currentPage = pageMap.get(currentPath);

      if (!currentPage) continue;

      // このページからリンクしている先を探索（通常リンク + 共通リンク）
      const allLinks = [...currentPage.links, ...commonLinks];
      for (const link of allLinks) {
        // リンク先がクロール済みページにあり、まだ到達済みでない場合
        if (pageMap.has(link) && !reachable.has(link)) {
          reachable.add(link);
          queue.push(link);
        }
      }
    }

    return reachable;
  }

  // ターゲットページ一覧を取得
  getTargetPages(): string[] {
    return [...this.targetPages];
  }

  // ページがターゲットかどうか
  isTargetPage(path: string): boolean {
    return this.targetPages.includes(path);
  }

  // ページがクリア済みかどうか
  isPageCleared(path: string): boolean {
    return this.clearedPages.has(path);
  }

  // ページをクリア済みにする
  markPageCleared(path: string): void {
    if (this.isTargetPage(path)) {
      this.clearedPages.add(path);
    }
  }

  // ゲーム完了判定（全ターゲットページクリア）
  isGameComplete(): boolean {
    return this.targetPages.every(p => this.clearedPages.has(p));
  }

  // 経過時間を取得（ミリ秒）
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  // 経過時間をフォーマット（MM:SS.mmm）
  getFormattedTime(): string {
    const ms = this.getElapsedTime();
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }

  // 進捗を取得
  getProgress(): { cleared: number; total: number } {
    return {
      cleared: this.clearedPages.size,
      total: this.targetPages.length,
    };
  }

  // ページ遷移時に履歴に追加
  pushPage(path: string): void {
    if (this.pageHistory[this.pageHistory.length - 1] !== path) {
      this.pageHistory.push(path);
    }
    this.currentPagePath = path;
  }

  // 戻る（履歴から前のページを取得）
  popPage(): string | null {
    if (this.pageHistory.length <= 1) {
      return null; // スタート地点では戻れない
    }
    this.pageHistory.pop(); // 現在のページを削除
    return this.pageHistory[this.pageHistory.length - 1] || null;
  }

  // 現在のページパスを取得
  getCurrentPagePath(): string {
    return this.currentPagePath;
  }

  // ページの状態を保存（敵のみ）
  savePageState(path: string, enemies: EnemySnapshot[], cleared: boolean): void {
    this.pageStates.set(path, {
      path,
      enemies,
      cleared,
    });
  }

  // ページの敵状態を読み込み
  loadPageState(path: string): PageState | null {
    return this.pageStates.get(path) || null;
  }

  // ページの敵状態があるか
  hasPageState(path: string): boolean {
    return this.pageStates.has(path);
  }
}

// シングルトンインスタンス
export const gameState = new GameState();
