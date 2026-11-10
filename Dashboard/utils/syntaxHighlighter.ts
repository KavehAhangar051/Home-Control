/**
 * @file utils/syntaxHighlighter.ts
 * @description Safe syntax highlighting utility using highlight.js with language normalization.
 */

import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import ruby from 'highlight.js/lib/languages/ruby';
import java from 'highlight.js/lib/languages/java';
import php from 'highlight.js/lib/languages/php';
import c from 'highlight.js/lib/languages/c';
import diff from 'highlight.js/lib/languages/diff';
import ini from 'highlight.js/lib/languages/ini';
import scss from 'highlight.js/lib/languages/scss';
import graphql from 'highlight.js/lib/languages/graphql';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import kotlin from 'highlight.js/lib/languages/kotlin';
import swift from 'highlight.js/lib/languages/swift';
import dart from 'highlight.js/lib/languages/dart';
import powershell from 'highlight.js/lib/languages/powershell';
import makefile from 'highlight.js/lib/languages/makefile';
import { segmentHtmlByLanguage } from '@/utils/typographySegmenter';
import { hasPersianText } from '@/utils/persianizer';
import { createBoundedCache, CacheTelemetryStats } from '@/utils/lruCache';
import { enhanceHighlightedHtml, enhanceControlKeywords } from '@/utils/cFamilyEnhancer';

// Register core and popular languages on startup
const REGISTERED_LANGUAGES = [
  ['javascript', javascript], ['typescript', typescript], ['python', python],
  ['bash', bash], ['json', json], ['yaml', yaml], ['markdown', markdown],
  ['xml', xml], ['css', css], ['cpp', cpp], ['csharp', csharp], ['go', go],
  ['rust', rust], ['sql', sql], ['ruby', ruby], ['java', java], ['php', php],
  ['c', c], ['diff', diff], ['ini', ini], ['scss', scss], ['graphql', graphql],
  ['dockerfile', dockerfile], ['kotlin', kotlin], ['swift', swift], ['dart', dart],
  ['powershell', powershell], ['makefile', makefile],
] as const;

for (const [name, grammar] of REGISTERED_LANGUAGES) {
  hljs.registerLanguage(name, grammar);
}

/** Static module-level language alias mapping avoiding per-call object allocations */
const LANGUAGE_ALIAS_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', python3: 'python', py3: 'python',
  sh: 'bash', shell: 'bash', zsh: 'bash', bash: 'bash',
  yml: 'yaml', yaml: 'yaml', md: 'markdown', markdown: 'markdown',
  rb: 'ruby', ruby: 'ruby', cs: 'csharp', csharp: 'csharp', 'c#': 'csharp',
  'c++': 'cpp', cpp: 'cpp', c: 'c', golang: 'go', go: 'go', rs: 'rust', rust: 'rust',
  htm: 'xml', html: 'xml', xhtml: 'xml', svg: 'xml', xml: 'xml',
  json: 'json', css: 'css', scss: 'scss', sass: 'scss', diff: 'diff',
  docker: 'dockerfile', dockerfile: 'dockerfile', ini: 'ini',
  graphql: 'graphql', gql: 'graphql', kt: 'kotlin', kotlin: 'kotlin',
  swift: 'swift', dart: 'dart', sql: 'sql',
  ps1: 'powershell', pwsh: 'powershell', powershell: 'powershell',
  make: 'makefile', makefile: 'makefile',
  txt: 'text', plain: 'text', plaintext: 'text', none: 'text', raw: 'text', text: 'text',
  auto: 'auto',
} as const;

type KnownLanguageAlias = keyof typeof LANGUAGE_ALIAS_MAP;

const LANGUAGE_DISPLAY_MAP = {
  javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
  bash: 'Bash', json: 'JSON', yaml: 'YAML', markdown: 'Markdown',
  xml: 'HTML / XML', css: 'CSS', cpp: 'C++', csharp: 'C#', c: 'C',
  go: 'Go', rust: 'Rust', sql: 'SQL', ruby: 'Ruby', java: 'Java', php: 'PHP',
  dockerfile: 'Docker', graphql: 'GraphQL', kotlin: 'Kotlin', swift: 'Swift',
  dart: 'Dart', scss: 'SCSS', diff: 'Diff', ini: 'INI',
  makefile: 'Makefile', powershell: 'PowerShell',
} as const;

/**
 * Normalizes common language aliases to highlight.js supported identifiers.
 *
 * @param {string} [lang] - Raw language name or extension.
 * @returns {string} Normalized language identifier supported by highlight.js.
 */
export function normalizeLanguage(lang?: string): string {
  if (!lang) return '';
  const clean = lang.trim().toLowerCase();

  if (Object.hasOwn(LANGUAGE_ALIAS_MAP, clean)) {
    // SAFETY: Verified membership in LANGUAGE_ALIAS_MAP via Object.hasOwn
    return LANGUAGE_ALIAS_MAP[clean as KnownLanguageAlias];
  }

  return clean;
}

/**
 * Formats a raw or normalized language identifier into a human-readable badge label.
 * Pulls display-label resolution into the syntaxHighlighter module so UI callers do not duplicate tables.
 *
 * @param {string} [lang] - Raw or normalized language identifier.
 * @param {boolean} [isPersian] - Whether the active UI locale is Persian.
 * @returns {string} Display label for code block headers.
 */
export function formatLanguageDisplayName(lang?: string, isPersian?: boolean): string {
  const norm = normalizeLanguage(lang);

  if (!norm || norm === 'text') {
    return isPersian ? 'متن' : 'TEXT';
  }

  // SAFETY: Checked via Object.hasOwn before indexing LANGUAGE_DISPLAY_MAP
  if (Object.hasOwn(LANGUAGE_DISPLAY_MAP, norm)) {
    return LANGUAGE_DISPLAY_MAP[norm as keyof typeof LANGUAGE_DISPLAY_MAP];
  }

  return norm.toUpperCase();
}

/** Maximum number of highlighted code snippets retained in memory */
const HIGHLIGHT_CACHE_LIMIT = 200;

export interface HighlightResult {
  readonly html: string;
  readonly language: string;
  readonly dir: 'ltr' | 'rtl';
}

/** Internal bounded LRU cache for syntax highlight computations */
const highlightCache = createBoundedCache<HighlightResult>(HIGHLIGHT_CACHE_LIMIT);

/**
 * Resets the syntax highlighter LRU cache and tracking metrics.
 */
export function clearHighlightCache(): void {
  highlightCache.clear();
}

/**
 * Snapshot of syntax highlighter cache performance metrics.
 */
export type HighlightCacheStats = CacheTelemetryStats;

/**
 * Retrieves performance metrics for the syntax highlighter LRU cache.
 *
 * @returns {HighlightCacheStats} Cache performance snapshot.
 */
export function getHighlightCacheStats(): HighlightCacheStats {
  return highlightCache.getStats();
}

/**
 * Highlights a string of source code using highlight.js with LRU caching.
 * Encapsulates language alias normalization, C-family semantic token enhancement,
 * hybrid Persian/Latin script segmentation, and block text direction (`ltr` vs `rtl`).
 *
 * @param {string} code - The raw source code string to highlight.
 * @param {string} [language] - Target programming language.
 * @returns {HighlightResult} Highlighted HTML markup, resolved language, and block direction.
 */
export function highlightCode(code: string, language?: string): HighlightResult {
  const normLang = normalizeLanguage(language);
  const cacheKey = `${normLang}::${code}`;

  const cached = highlightCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  let rawHtml = '';
  let resolvedLang = normLang || 'text';
  const isPlainTextBlock = !normLang || normLang === 'text';

  // Plain text or unlabelled blocks: guarantee zero false-positive syntax guessing
  if (isPlainTextBlock) {
    rawHtml = escapeHtml(code);
    resolvedLang = 'text';
  } else if (hljs.getLanguage(normLang)) {
    try {
      const hlResult = hljs.highlight(code, {
        language: normLang,
        ignoreIllegals: true,
      });

      rawHtml = hlResult.value;
      resolvedLang = normLang;
    } catch {
      rawHtml = escapeHtml(code);
    }
  } else if (normLang === 'auto') {
    try {
      const autoResult = hljs.highlightAuto(code);

      if (autoResult.language && (autoResult.relevance ?? 0) >= 4 && autoResult.value) {
        rawHtml = autoResult.value;
        resolvedLang = autoResult.language;
      }
    } catch {
      // Fallback on auto-detection error
    }
  }

  if (!rawHtml && code) {
    rawHtml = escapeHtml(code);
  }

  // Enhance C-family & systems languages with VSCode-level semantic tokens
  const enhancedHtml = enhanceControlKeywords(enhanceHighlightedHtml(rawHtml, resolvedLang));

  // Plain-text blocks containing Persian characters render RTL; code blocks always render LTR
  const dir: 'ltr' | 'rtl' =
    resolvedLang === 'text' && hasPersianText(code) ? 'rtl' : 'ltr';

  // Apply character-level font segmentation to HTML tokens
  const segmentedResult: HighlightResult = {
    html: segmentHtmlByLanguage(enhancedHtml),
    language: resolvedLang,
    dir,
  };

  highlightCache.set(cacheKey, segmentedResult);

  return segmentedResult;
}

const HTML_ESCAPE_TEST_REGEX = /[&<>"']/;

/**
 * Escapes special HTML characters to prevent XSS.
 *
 * @param {string} text - Raw string.
 * @returns {string} HTML-escaped string.
 */
function escapeHtml(text: string): string {
  if (!text) return '';

  if (!HTML_ESCAPE_TEST_REGEX.test(text)) return text;

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

