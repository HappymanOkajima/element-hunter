import type { CrawlPage } from '../types';
import { gameState } from '../systems/gameState';

// コンテンツパネルのUI管理
export class ContentPanel {
  private pageTitleEl: HTMLElement | null;
  private pagePathEl: HTMLElement | null;
  private progressFillEl: HTMLElement | null;
  private progressTextEl: HTMLElement | null;
  private timerEl: HTMLElement | null;
  private targetListEl: HTMLElement | null;
  private pageContentEl: HTMLElement | null;

  // セクション要素（表示/非表示切替用）
  private headerSection: HTMLElement | null;
  private progressSection: HTMLElement | null;
  private targetsSection: HTMLElement | null;
  private textSection: HTMLElement | null;

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private allPages: CrawlPage[] = [];

  constructor() {
    this.pageTitleEl = document.getElementById('page-title');
    this.pagePathEl = document.getElementById('page-path');
    this.progressFillEl = document.getElementById('progress-fill');
    this.progressTextEl = document.getElementById('progress-text');
    this.timerEl = document.getElementById('timer');
    this.targetListEl = document.getElementById('target-list');
    this.pageContentEl = document.getElementById('page-content');

    // セクション要素を取得（親要素）
    this.headerSection = this.pageTitleEl?.closest('.panel-header') as HTMLElement | null;
    this.progressSection = this.progressFillEl?.closest('.panel-progress') as HTMLElement | null;
    this.targetsSection = this.targetListEl?.closest('.panel-targets') as HTMLElement | null;
    this.textSection = this.pageContentEl?.closest('.panel-text') as HTMLElement | null;
  }

  // 全ページデータを設定
  setAllPages(pages: CrawlPage[]): void {
    this.allPages = pages;
  }

  // ターゲットページ一覧を更新
  updateTargetList(): void {
    if (!this.targetListEl) return;

    const targets = gameState.getTargetPages();
    const currentPath = gameState.getCurrentPagePath();

    this.targetListEl.innerHTML = targets.map(path => {
      const page = this.allPages.find(p => p.path === path);
      const fullTitle = page?.title || path;
      const isNarrow = window.innerWidth < 900;
      const maxLen = isNarrow ? 30 : 50;
      const title = fullTitle.length > maxLen ? fullTitle.slice(0, maxLen) + '...' : fullTitle;
      const isCleared = gameState.isPageCleared(path);
      const isCurrent = path === currentPath;

      let className = 'target-item';
      if (isCleared) className += ' cleared';
      if (isCurrent) className += ' current';

      return `
        <li class="${className}">
          <span class="target-check">${isCleared ? '✓' : '○'}</span>
          <span>${title}</span>
        </li>
      `;
    }).join('');
  }

  // 進捗を更新
  updateProgress(): void {
    const progress = gameState.getProgress();

    if (this.progressFillEl) {
      const percentage = (progress.cleared / progress.total) * 100;
      this.progressFillEl.style.width = `${percentage}%`;
    }

    if (this.progressTextEl) {
      this.progressTextEl.textContent = `${progress.cleared} / ${progress.total} PAGES`;
    }
  }

  // タイマー開始
  startTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      if (this.timerEl) {
        this.timerEl.textContent = gameState.getFormattedTime();
      }
    }, 100);
  }

  // タイマー停止
  stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // 現在のページコンテンツを更新
  updateContent(page: CrawlPage, isUnlocked: boolean): void {
    // タイトルとパス（画面幅に応じて省略）
    if (this.pageTitleEl) {
      const isNarrow = window.innerWidth < 900;
      const maxLen = isNarrow ? 30 : 50;
      this.pageTitleEl.textContent = page.title.slice(0, maxLen) + (page.title.length > maxLen ? '...' : '');
    }
    if (this.pagePathEl) {
      this.pagePathEl.textContent = page.path;
    }

    // テキストコンテンツ（HTML構造を保持）
    if (this.pageContentEl) {
      if (isUnlocked) {
        // 許可されたタグのみ表示（XSS対策）
        const safeHtml = this.sanitizeHtml(page.textContent || '');
        this.pageContentEl.innerHTML = `<div class="content">${safeHtml || 'NO CONTENT AVAILABLE'}</div>`;
      } else {
        this.pageContentEl.innerHTML = '<div class="locked">HUNT ALL ELEMENTS TO UNLOCK CONTENT</div>';
      }
    }

    // ターゲットリストも更新
    this.updateTargetList();
  }

  // HTMLをサニタイズ（許可されたタグのみ残す）
  private sanitizeHtml(html: string): string {
    const allowedTags = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'br'];
    // 許可されていないタグを除去
    return html.replace(/<\/?([a-z][a-z0-9]*)[^>]*>/gi, (match, tag) => {
      if (allowedTags.includes(tag.toLowerCase())) {
        if (match.startsWith('</')) {
          return `</${tag.toLowerCase()}>`;
        }
        return `<${tag.toLowerCase()}>`;
      }
      return '';
    });
  }

  // ページクリア時のエフェクト
  showPageClearEffect(): void {
    // 進捗を更新
    this.updateProgress();
    this.updateTargetList();

    // コンテンツをアンロック状態に（後でupdateContentで反映）
    if (this.pageContentEl) {
      this.pageContentEl.classList.add('unlocked');
    }
  }

  // ゲーム完了時
  showGameComplete(siteName?: string, mode?: 'easy' | 'normal', isNewRecord?: boolean): void {
    this.stopTimer();

    if (this.pageContentEl) {
      const finalTime = gameState.getFormattedTime();

      // ベストタイム取得（引数がある場合のみ）
      let bestTimeHtml = '';
      if (siteName && mode) {
        const bestTime = gameState.formatBestTime(siteName, mode);
        if (isNewRecord) {
          bestTimeHtml = `<div style="font-size:16px;color:#ff6b6b;font-weight:bold;margin-top:10px;">★ NEW RECORD! ★</div>`;
        } else if (bestTime) {
          bestTimeHtml = `<div style="font-size:12px;color:#888;margin-top:10px;">BEST: ${bestTime}</div>`;
        }
      }

      this.pageContentEl.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:24px;color:#4caf50;margin-bottom:10px;">🎉 COMPLETE!</div>
          <div style="font-size:18px;color:#ffcc00;margin-bottom:10px;">TIME: ${finalTime}</div>
          ${bestTimeHtml}
          <div style="font-size:14px;color:#aaa;margin-top:15px;">ALL TARGET PAGES CLEARED!</div>
        </div>
      `;
    }
  }

  // タイトル画面用の初期表示
  showTitleScreen(siteName: string): void {
    // ヘッダー、プログレス、ターゲットを非表示
    if (this.headerSection) this.headerSection.style.display = 'none';
    if (this.progressSection) this.progressSection.style.display = 'none';
    if (this.targetsSection) this.targetsSection.style.display = 'none';

    // テキストセクションのヘッダーも非表示
    if (this.textSection) {
      const h3 = this.textSection.querySelector('h3');
      if (h3) h3.style.display = 'none';
    }

    // コンテンツ: ストーリー + TODAY'S STAGE + BEST TIME
    if (this.pageContentEl) {
      // ベストタイムを取得
      const easyBest = gameState.formatBestTime(siteName, 'easy');
      const normalBest = gameState.formatBestTime(siteName, 'normal');
      const hasBestTime = easyBest || normalBest;

      // ベストタイムセクションのHTML
      const bestTimeHtml = hasBestTime ? `
        <div style="border-top:1px solid #444;padding-top:15px;margin-top:15px;">
          <div style="font-size:11px;color:#888;margin-bottom:8px;letter-spacing:1px;">BEST TIME</div>
          <div style="display:flex;justify-content:center;gap:20px;font-size:12px;">
            ${easyBest ? `<div><span style="color:#8bc34a;">EASY:</span> <span style="color:#ffcc00;font-family:monospace;">${easyBest}</span></div>` : ''}
            ${normalBest ? `<div><span style="color:#ff9800;">NORMAL:</span> <span style="color:#ffcc00;font-family:monospace;">${normalBest}</span></div>` : ''}
          </div>
        </div>
      ` : '';

      this.pageContentEl.innerHTML = `
        <div style="padding:20px;text-align:center;">
          <div style="font-size:18px;color:#64b5f6;font-weight:bold;margin-bottom:15px;letter-spacing:1px;">
            I AM THE ELEMENT HUNTER.
          </div>
          <div style="font-size:14px;color:#aaa;line-height:1.8;margin-bottom:20px;">
            MY JOB IS TO HUNT<br>
            ESCAPED HTML ELEMENTS.
          </div>
          <div style="font-size:15px;color:#ffcc00;font-weight:bold;letter-spacing:0.5px;margin-bottom:25px;">
            LET'S HUNT THEM ALL BY FIRE<br>
            AND RECLAIM THE CONTENTS!
          </div>
          <div style="border-top:1px solid #444;padding-top:20px;margin-top:10px;">
            <div style="font-size:11px;color:#888;margin-bottom:8px;letter-spacing:1px;">TODAY'S STAGE</div>
            <div style="font-size:13px;color:#88ccff;font-weight:bold;line-height:1.6;">${siteName}</div>
          </div>
          ${bestTimeHtml}
        </div>
      `;
    }
  }

  // ゲーム画面用の表示（セクションを再表示）
  showGameLayout(): void {
    if (this.headerSection) this.headerSection.style.display = '';
    if (this.progressSection) this.progressSection.style.display = '';
    if (this.targetsSection) this.targetsSection.style.display = '';

    if (this.textSection) {
      const h3 = this.textSection.querySelector('h3');
      if (h3) h3.style.display = '';
    }
  }
}

// シングルトンインスタンス
export const contentPanel = new ContentPanel();
