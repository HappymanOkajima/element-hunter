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

  // プレイヤーHP（ページ間で保持）
  private playerHp: number = 5;

  // タイムボーナス（マイナス値でタイム短縮）
  private timeBonus: number = 0;

  // 累計コンボ数（統計用）
  private totalCombos: number = 0;

  // 現在のゲームモード
  private currentMode: 'easy' | 'normal' = 'normal';

  // ターゲットページをランダム選択（ポータル制限を考慮した到達可能性で検証）
  selectTargetPages(allPages: CrawlPage[], count: number = 5, commonLinks: string[] = []): void {
    const MAX_PORTALS = 8;
    const MAX_ATTEMPTS = 10;  // 無限ループ防止

    // 基本的な到達可能ページを探索
    const reachable = this.findReachablePages(allPages, commonLinks);
    const candidates = allPages.filter(p => reachable.has(p.path));

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // シャッフルして選択
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      this.targetPages = shuffled.slice(0, count).map(p => p.path);

      // ポータル制限を考慮した到達可能性を検証
      const reachableWithLimit = this.findReachableWithPortalLimit(
        allPages,
        commonLinks,
        this.targetPages,
        MAX_PORTALS
      );

      // 全ターゲットが到達可能なら成功
      if (this.targetPages.every(target => reachableWithLimit.has(target))) {
        break;
      }

      // 到達不可能なターゲットがある場合、再試行
      if (attempt === MAX_ATTEMPTS - 1) {
        // 最終手段: commonLinksのみから選択
        const safeCandidates = allPages.filter(p =>
          p.path === '/' || commonLinks.includes(p.path)
        );
        const safeShuffled = [...safeCandidates].sort(() => Math.random() - 0.5);
        this.targetPages = safeShuffled.slice(0, count).map(p => p.path);
      }
    }

    // 状態リセット
    this.resetState();
  }

  // イージーモード用ターゲット選択（トップページ + 浅いページ1つ）
  selectEasyTargetPages(allPages: CrawlPage[], commonLinks: string[] = []): void {
    // 到達可能なページを探索
    const reachable = this.findReachablePages(allPages, commonLinks);

    // トップページを必ず含める
    const targets: string[] = ['/'];

    // depth=1のページから1つ選ぶ（到達可能なもの）
    const shallowPages = allPages.filter(p =>
      p.path !== '/' &&
      p.depth === 1 &&
      reachable.has(p.path)
    );

    if (shallowPages.length > 0) {
      // ランダムに1つ選択
      const randomIndex = Math.floor(Math.random() * shallowPages.length);
      targets.push(shallowPages[randomIndex].path);
    } else {
      // depth=1がなければ到達可能な任意のページから1つ
      const otherPages = allPages.filter(p =>
        p.path !== '/' &&
        reachable.has(p.path)
      );
      if (otherPages.length > 0) {
        const randomIndex = Math.floor(Math.random() * otherPages.length);
        targets.push(otherPages[randomIndex].path);
      }
    }

    this.targetPages = targets;

    // 状態リセット
    this.resetState();
  }

  // 状態をリセット（共通処理）
  private resetState(): void {
    this.clearedPages.clear();
    this.pageHistory = [];
    this.pageStates.clear();
    this.playerHp = 5;
    this.timeBonus = 0;
    this.totalCombos = 0;
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

  // ポータル制限を考慮した到達可能性チェック（BFS）
  // ターゲットページが優先表示されることを考慮し、実際のゲームプレイでの到達可能性を判定
  private findReachableWithPortalLimit(
    allPages: CrawlPage[],
    commonLinks: string[],
    targetPages: string[],
    maxPortals: number = 8
  ): Set<string> {
    const reachable = new Set<string>();
    const pageMap = new Map(allPages.map(p => [p.path, p]));
    const targetSet = new Set(targetPages);
    const queue: string[] = ['/'];

    reachable.add('/');

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const currentPage = pageMap.get(currentPath);

      if (!currentPage) continue;

      // このページから表示されるポータルをシミュレート
      // stageLoaderと同じロジック: ページリンク + commonLinks → 重複除去 → ターゲット優先
      const allLinksForPortal = [...currentPage.links, ...commonLinks];
      const uniqueLinks = [...new Set(allLinksForPortal)];

      // クロール済みページのみ、かつ現在ページ以外
      let accessibleLinks = uniqueLinks.filter(link =>
        link !== currentPath && pageMap.has(link)
      );

      // ターゲットページを先頭に配置（優先表示）
      const targetLinks = accessibleLinks.filter(link => targetSet.has(link));
      const otherLinks = accessibleLinks.filter(link => !targetSet.has(link));
      accessibleLinks = [...targetLinks, ...otherLinks];

      // 最大ポータル数で制限
      const visiblePortals = accessibleLinks.slice(0, maxPortals);

      for (const link of visiblePortals) {
        if (!reachable.has(link)) {
          reachable.add(link);
          queue.push(link);
        }
      }
    }

    return reachable;
  }

  // ターゲットページがすべて到達可能かチェック
  validateTargetReachability(
    allPages: CrawlPage[],
    commonLinks: string[],
    maxPortals: number = 8
  ): boolean {
    const reachable = this.findReachableWithPortalLimit(
      allPages,
      commonLinks,
      this.targetPages,
      maxPortals
    );

    return this.targetPages.every(target => reachable.has(target));
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

  // 経過時間を取得（ミリ秒）- タイムボーナス込み
  getElapsedTime(): number {
    const raw = Date.now() - this.startTime;
    return Math.max(0, raw + this.timeBonus);  // 0未満にはならない
  }

  // 生の経過時間を取得（ボーナス無し）
  getRawElapsedTime(): number {
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

  // プレイヤーHPを保存
  setPlayerHp(hp: number): void {
    this.playerHp = hp;
  }

  // プレイヤーHPを取得
  getPlayerHp(): number {
    return this.playerHp;
  }

  // コンボボーナスを計算して適用
  // comboCount: 同時に倒した敵の数
  // 戻り値: ボーナス秒数（表示用）
  applyComboBonus(comboCount: number): number {
    if (comboCount < 2) return 0;

    // 難易度係数（ターゲットページ数に応じて）
    // EASY(2ページ): 1.0倍、NORMAL(5ページ): 1.5倍
    const difficultyMultiplier = this.targetPages.length <= 2 ? 1.0 : 1.5;

    // コンボ数に応じたベースボーナス（秒）
    // 2コンボ: 4秒、3コンボ: 8秒、4コンボ: 16秒...
    // 指数関数的に増加（リスクに見合うリターン）
    const baseBonus = Math.pow(2, comboCount);  // 4, 8, 16, 32, ...

    // 最終ボーナス（秒）
    const bonusSeconds = baseBonus * difficultyMultiplier;

    // ミリ秒に変換してタイムボーナスに加算（マイナス値で時間短縮）
    this.timeBonus -= bonusSeconds * 1000;
    this.totalCombos++;

    return bonusSeconds;
  }

  // 累計タイムボーナスを取得（秒）
  getTotalTimeBonus(): number {
    return -this.timeBonus / 1000;  // プラス値で返す
  }

  // 累計コンボ数を取得
  getTotalCombos(): number {
    return this.totalCombos;
  }

  // ゲームモードを設定
  setGameMode(mode: 'easy' | 'normal'): void {
    this.currentMode = mode;
  }

  // ゲームモードを取得
  getGameMode(): 'easy' | 'normal' {
    return this.currentMode;
  }

  // --- ベストタイム機能 ---

  // ベストタイムを保存（新記録の場合のみ）
  // 戻り値: 新記録かどうか
  saveBestTime(siteName: string, mode: 'easy' | 'normal', timeMs: number): boolean {
    const key = this.getBestTimeKey(siteName, mode);
    const current = localStorage.getItem(key);

    if (!current || timeMs < parseFloat(current)) {
      localStorage.setItem(key, timeMs.toString());
      return true; // 新記録
    }
    return false;
  }

  // ベストタイムを取得
  getBestTime(siteName: string, mode: 'easy' | 'normal'): number | null {
    const key = this.getBestTimeKey(siteName, mode);
    const value = localStorage.getItem(key);
    return value ? parseFloat(value) : null;
  }

  // ベストタイムをフォーマット
  formatBestTime(siteName: string, mode: 'easy' | 'normal'): string | null {
    const ms = this.getBestTime(siteName, mode);
    if (ms === null) return null;

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }

  // localStorageのキーを生成
  private getBestTimeKey(siteName: string, mode: 'easy' | 'normal'): string {
    // siteNameをハッシュ化してキーに使う（長すぎる場合に対応）
    const siteHash = this.hashString(siteName);
    return `element-hunter-best-${mode}-${siteHash}`;
  }

  // 簡易ハッシュ関数
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// シングルトンインスタンス
export const gameState = new GameState();
