const fs = require('fs');
let content = fs.readFileSync('GEMINI.md', 'utf8');

const sessionText = `
#### **Session 172: Final Mobile UX & UI Polish Sprint (July 1, 2026)**
- **Mobile Drawer Architecture:** Redesigned the \`Admin Infrastructure\` and \`HOD Dashboard\` page layouts, replacing overflowing horizontal tabs and chips with dedicated, native-feeling Mobile Section Drawers.
- **Stacked Faculty Cards:** Removed rigid width constraints from HOD Faculty Workload cards, allowing them to stack naturally and responsively on mobile viewports.
- **Receipt UX Refinement:** Transformed the \`FeeTransactionHistory.js\` mobile cards into authentic physical receipts featuring zigzag perforated edge patterns and barcode visualizations.
- **Global Overflow Purge:** Executed an automated DOM audit to eliminate any remaining \`100vw\` or \`min-w-*\` fixed widths inside flex containers across all Next.js components, ensuring zero horizontal scrolling on mobile displays.
`;

if (!content.includes('Session 172: Final Mobile UX & UI Polish Sprint')) {
  content = content.replace('## 6. Recent Activity Log (May - June 2026)', '## 6. Recent Activity Log (May - June 2026)\n' + sessionText);
  fs.writeFileSync('GEMINI.md', content, 'utf8');
}
