# ADR 0005: Deep Markdown Domain Module & In-Process Engine Seam

## Status
Accepted

## Date
2026-09-03

## Context
Prior to this decision, Markdown transformation, document metrics calculation, heading extraction, and export preparation were fragmented across multiple shallow utility functions (`rtlConverter.ts`, `statsCalculator.ts`, `persianizer.ts`, and `fileHelpers.ts`). Callers in the UI and React Context had to manually orchestrate multi-step operations and mix browser-specific DOM side-effects (`Blob`, `URL.createObjectURL`, `document.createElement('a')`) with pure document calculations.

## Decision
In accordance with John Ousterhout's Deep Module Principle and the codebase design guidelines:
1. **Unified Deep Interface (`services/markdownEngine.ts`):** We created a centralized domain module exposing two cohesive, high-leverage entry points:
   - `processDocument(rawText: string, options?: ProcessDocumentOptions): ProcessedDocument`: Encapsulates RTL table transformations, code-block protection, Persian character tokenization, reading speed calculations, and document title extraction (supporting both ATX `# Title` and Setext `Title\n===` formats) behind a single seam.
   - `prepareExportBundle(markdown: string, customTitle?: string): ExportBundle`: Pure in-process serialization that generates sanitized filenames, MIME configurations, and content payloads without DOM coupling.
2. **Deep Syntax Highlighting & File Upload Seams:**
   - `highlightCode(code: string, language?: string): HighlightResult` and `formatLanguageDisplayName(lang?: string, isPersian?: boolean): string` in `utils/syntaxHighlighter.ts` encapsulate language alias normalization, C-family semantic token enhancement, Persian/Latin hybrid script segmentation, block direction (`ltr` vs `rtl` for plain-text Persian blocks), and display badge formatting so UI components (`CodeBlock`, `CodeBlockHeader`) have high caller leverage.
   - `processUploadedMarkdownFile(file?: File | null): Promise<UploadedMarkdownFileResult>` in `utils/fileHelpers.ts` encapsulates extension/size validation and asynchronous text reading behind a single discriminated-union adapter interface.
3. **Seam Placement & Dependency Discipline:**
   - Text parsing, AST manipulation, and analytics are strictly in-process, pure functions with zero React or browser globals dependency.
   - Browser DOM operations (`downloadFile`, `readTextFile`, `processUploadedMarkdownFile`) remain segregated inside `utils/fileHelpers.ts` as thin platform adapters.
4. **The Interface is the Test Surface:** Contract tests directly exercise the deepened module interfaces (`tests/domain-contracts.test.ts`), verifying end-to-end domain behavior and observable outcomes without mocking internal helpers.

## Consequences
- **Positive:** High caller leverage and strong locality: React Context, Hooks, and Components interact with cohesive module interfaces rather than stitching shallow utilities together.
- **Positive:** Maximum domain purity: The engine and highlighter can run unchanged across Node.js, CLI scripts, serverless runtimes, or Web Workers.
- **Positive:** Fast test execution: Testing at the module interface requires no mock browser DOM or fragile internal stubs.

