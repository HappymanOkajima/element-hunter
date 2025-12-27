#!/usr/bin/env node

import { program } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { crawl } from './crawler.js';
import type { CrawlOptions } from './types.js';

const VERSION = '0.1.0';

program
  .name('eh-crawl')
  .description('ELEMENT HUNTER - Website Crawler')
  .version(VERSION)
  .argument('<url>', 'Target URL to crawl')
  .option('-o, --output <dir>', 'Output directory', '../../data/sites')
  .option('-d, --max-depth <n>', 'Maximum crawl depth', '3')
  .option('-p, --max-pages <n>', 'Maximum pages to crawl', '50')
  .option('--delay <ms>', 'Delay between requests (ms)', '1000')
  .option('-t, --timeout <ms>', 'Page load timeout (ms)', '30000')
  .option('-i, --site-id <id>', 'Site ID (auto-generated if not specified)')
  .option('-n, --site-name <name>', 'Site name (from page title if not specified)')
  .option('--common-threshold <n>', 'Common link detection threshold (0-1)', '0.8')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (url: string, opts) => {
    console.log(chalk.cyan.bold('\nElement Hunter Crawler v' + VERSION));
    console.log(chalk.gray('━'.repeat(50)));

    // オプションを解析
    const options: CrawlOptions = {
      url,
      output: resolve(opts.output),
      maxDepth: parseInt(opts.maxDepth, 10),
      maxPages: parseInt(opts.maxPages, 10),
      delay: parseInt(opts.delay, 10),
      timeout: parseInt(opts.timeout, 10),
      siteId: opts.siteId,
      siteName: opts.siteName,
      commonThreshold: parseFloat(opts.commonThreshold),
      verbose: opts.verbose,
    };

    // URL検証
    try {
      new URL(options.url);
    } catch {
      console.error(chalk.red('Error: Invalid URL'));
      process.exit(1);
    }

    console.log(chalk.white(`Target: ${chalk.green(options.url)}`));
    console.log(chalk.white(`Max Depth: ${options.maxDepth}`));
    console.log(chalk.white(`Max Pages: ${options.maxPages}`));
    console.log(chalk.gray('━'.repeat(50)));
    console.log('');

    const spinner = ora('Starting crawler...').start();

    try {
      // クロール実行
      spinner.text = 'Crawling pages...';
      const result = await crawl(options);

      spinner.succeed('Crawl complete!');
      console.log('');

      // 結果を表示
      console.log(chalk.gray('━'.repeat(50)));
      console.log(chalk.bold('Results:'));
      console.log(`  Pages crawled: ${chalk.green(result.metadata.totalPages)}`);
      console.log(`  Total elements: ${chalk.green(result.metadata.totalElements)}`);
      console.log(`  Common links: ${chalk.yellow(result.commonLinks.length)} (excluded)`);
      console.log(`  Rare elements: ${chalk.magenta(result.rareElements.join(', ') || 'none')}`);
      console.log(`  Deepest pages: ${chalk.blue(result.deepestPages.slice(0, 3).join(', '))}`);
      console.log(`  Duration: ${(result.metadata.crawlDuration / 1000).toFixed(1)}s`);

      // 出力ディレクトリを作成
      if (!existsSync(options.output)) {
        mkdirSync(options.output, { recursive: true });
      }

      // JSONを出力
      const outputPath = join(options.output, `${result.siteId}.json`);
      writeFileSync(outputPath, JSON.stringify(result, null, 2));

      console.log('');
      console.log(chalk.green(`Output: ${outputPath}`));
      console.log(chalk.gray('━'.repeat(50)));

    } catch (error) {
      spinner.fail('Crawl failed');
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program.parse();
