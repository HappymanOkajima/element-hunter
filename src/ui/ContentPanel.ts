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
      const title = page?.title.slice(0, 30) || path;
      const isCleared = gameState.isPageCleared(path);
      const isCurrent = path === currentPath;

      let className = 'target-item';
      if (isCleared) className += ' cleared';
      if (isCurrent) className += ' current';

      return `
        <li class="${className}">
          <span class="target-check">${isCleared ? '✓' : '○'}</span>
          <span>${title}${title.length >= 30 ? '...' : ''}</span>
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
      this.progressTextEl.textContent = `${progress.cleared} / ${progress.total} pages`;
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
    // タイトルとパス
    if (this.pageTitleEl) {
      this.pageTitleEl.textContent = page.title.slice(0, 50) + (page.title.length > 50 ? '...' : '');
    }
    if (this.pagePathEl) {
      this.pagePathEl.textContent = page.path;
    }

    // テキストコンテンツ（HTML構造を保持）
    if (this.pageContentEl) {
      if (isUnlocked) {
        // 許可されたタグのみ表示（XSS対策）
        const safeHtml = this.sanitizeHtml(page.textContent || '');
        this.pageContentEl.innerHTML = `<div class="content">${safeHtml || 'No content available'}</div>`;
      } else {
        this.pageContentEl.innerHTML = '<div class="locked">Stop all enemies to unlock content</div>';
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
  showGameComplete(): void {
    this.stopTimer();

    if (this.pageContentEl) {
      const finalTime = gameState.getFormattedTime();
      this.pageContentEl.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:24px;color:#4caf50;margin-bottom:10px;">🎉 COMPLETE!</div>
          <div style="font-size:18px;color:#ffcc00;margin-bottom:10px;">Time: ${finalTime}</div>
          <div style="font-size:14px;color:#aaa;">All target pages cleared!</div>
        </div>
      `;
    }
  }
}

// シングルトンインスタンス
export const contentPanel = new ContentPanel();
