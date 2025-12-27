# Element Hunter Crawler

ELEMENT HUNTERゲーム用のWebサイトクローラーCLIツール。

## セットアップ

```bash
cd tools/crawler
npm install
npx playwright install chromium
```

## 使い方

```bash
# 基本的な使い方
npm run crawl -- https://example.com

# 出力先を指定
npm run crawl -- https://example.com -o ../../data/sites

# 詳細オプション
npm run crawl -- https://example.com \
  --max-depth 4 \
  --max-pages 100 \
  --delay 2000 \
  --site-id my-site \
  --verbose
```

## オプション

| オプション | 短縮形 | デフォルト | 説明 |
|-----------|--------|----------|------|
| --output | -o | ../../data/sites | 出力ディレクトリ |
| --max-depth | -d | 3 | 最大クロール深度 |
| --max-pages | -p | 50 | 最大ページ数 |
| --delay | - | 1000 | リクエスト間隔(ms) |
| --timeout | -t | 30000 | タイムアウト(ms) |
| --site-id | -i | (自動生成) | サイトID |
| --site-name | -n | (タイトルから) | サイト名 |
| --common-threshold | - | 0.8 | 共通リンク閾値 |
| --verbose | -v | false | 詳細ログ |

## 出力

クロール結果は `{site-id}.json` として出力されます。

```json
{
  "siteId": "example",
  "siteName": "Example Site",
  "baseUrl": "https://example.com",
  "pages": [...],
  "deepestPages": [...],
  "rareElements": [...],
  "commonLinks": [...]
}
```

## 注意事項

- 許可されたサイトのみをクロールしてください
- --delay オプションでサーバー負荷を軽減できます
- robots.txt は現在チェックしていません（将来対応予定）
