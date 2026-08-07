'use client';

import React from 'react';

/**
 * Lightweight, robust Markdown Renderer component for AI Assistant responses.
 * Parses headers, bold, italics, code blocks, inline code, tables, lists, and badges.
 */
export default function MarkdownRenderer({ content = '' }) {
  if (!content) return null;

  // Split content by code blocks first
  const blocks = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-slate-800 text-sm leading-relaxed antialiased">
      {blocks.map((block, idx) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          // Code block
          const firstLineEnd = block.indexOf('\n');
          const lang = block.slice(3, firstLineEnd > 0 ? firstLineEnd : 3).trim() || 'text';
          const codeText = firstLineEnd > 0 ? block.slice(firstLineEnd + 1, -3).trim() : block.slice(3, -3).trim();

          return (
            <div key={idx} className="my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 text-slate-100 shadow-md font-mono text-xs">
              <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 border-b border-slate-700 text-slate-400 text-[11px] font-semibold tracking-wider uppercase">
                <span>{lang}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(codeText)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Copy Code
                </button>
              </div>
              <pre className="p-4 overflow-x-auto whitespace-pre-wrap">{codeText}</pre>
            </div>
          );
        }

        // Standard text lines / paragraphs
        return <ParagraphBlock key={idx} text={block} />;
      })}
    </div>
  );
}

function ParagraphBlock({ text }) {
  const lines = text.split('\n');
  const elements = [];
  let tableRows = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length > 0) {
      elements.push(<MarkdownTable key={`table-${elements.length}`} rows={tableRows} />);
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check table line
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Ignore separator line like | :--- | :--- |
      if (trimmed.replace(/[|\s:-]/g, '') === '') {
        return;
      }
      inTable = true;
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed) {
      elements.push(<div key={index} className="h-2" />);
      return;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-base font-extrabold text-[#0b3578] mt-4 mb-2 flex items-center gap-2">
          {formatInline(trimmed.slice(4))}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={index} className="text-sm font-bold text-slate-800 mt-3 mb-1">
          {formatInline(trimmed.slice(5))}
        </h4>
      );
      return;
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={index} className="ml-4 list-disc text-slate-700 my-0.5">
          {formatInline(trimmed.slice(2))}
        </li>
      );
      return;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      const contentStr = trimmed.replace(/^\d+\.\s/, '');
      elements.push(
        <li key={index} className="ml-4 list-decimal text-slate-700 my-0.5">
          {formatInline(contentStr)}
        </li>
      );
      return;
    }

    // Blockquote / Tip
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={index} className="border-l-4 border-amber-500 bg-amber-50/60 p-3 rounded-r-lg text-slate-700 text-xs my-2 italic">
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    // Standard paragraph line
    elements.push(
      <p key={index} className="my-1 text-slate-700">
        {formatInline(trimmed)}
      </p>
    );
  });

  flushTable();

  return <>{elements}</>;
}

function MarkdownTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  const header = rows[0];
  const body = rows.slice(1);

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-xs">
        <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider">
          <tr>
            {header.map((col, idx) => (
              <th key={idx} className="px-3 py-2 text-left font-semibold border-b border-slate-200">
                {formatInline(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {body.map((row, rIdx) => (
            <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-2 whitespace-nowrap text-slate-600">
                  {formatInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatInline(text) {
  if (!text) return null;

  // Split by inline code `code`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={pIdx} className="bg-slate-100 border border-slate-200 text-[#0b3578] px-1.5 py-0.5 rounded font-mono text-[12px] font-medium">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Process bold **text**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);

    return boldParts.map((bPart, bIdx) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        return (
          <strong key={bIdx} className="font-bold text-slate-900">
            {bPart.slice(2, -2)}
          </strong>
        );
      }

      // Process italic *text*
      const italicParts = bPart.split(/(\*[^*]+\*)/g);
      return italicParts.map((iPart, iIdx) => {
        if (iPart.startsWith('*') && iPart.endsWith('*')) {
          return <em key={iIdx} className="italic text-slate-800">{iPart.slice(1, -1)}</em>;
        }
        return iPart;
      });
    });
  });
}
