const React = require('react');
const ReactPDF = require('@react-pdf/renderer');
const { Document, Page, Text, View, StyleSheet, Font } = ReactPDF;

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#333',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2pt solid #0b3578',
    paddingBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0b3578',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0b3578',
    marginBottom: 10,
    textTransform: 'uppercase',
    borderLeft: '3pt solid #0b3578',
    paddingLeft: 8,
  },
  text: {
    lineHeight: 1.6,
    marginBottom: 10,
    textAlign: 'justify',
  },
  table: {
    display: 'table',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
    marginBottom: 15,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  tableCol: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bfbfbf',
    padding: 5,
  },
  tableCellHeader: {
    fontWeight: 'bold',
    fontSize: 10,
  },
  tableCell: {
    fontSize: 9,
  },
  bundleBox: {
    backgroundColor: '#f9fafb',
    padding: 15,
    borderRadius: 8,
    border: '1pt solid #e5e7eb',
    marginBottom: 10,
  },
  bundleTitle: {
    fontWeight: 'bold',
    color: '#0b3578',
    marginBottom: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999',
    fontSize: 9,
    borderTop: '1pt solid #eee',
    paddingTop: 10,
  }
});

const Proposal = () => (
  React.createElement(Document, {},
    React.createElement(Page, { size: "A4", style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.title }, "Infrastructure & Deployment Proposal"),
        React.createElement(Text, { style: styles.subtitle }, "KUCET College Management System | March 2026")
      ),

      // Summary
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "1. Executive Summary"),
        React.createElement(Text, { style: styles.text }, 
          "The KUCET CMS has reached the production-ready phase. To ensure the system is accessible to our 2,000+ students and faculty with high speed and security, we have identified a 'Budget-Professional' cloud infrastructure. This plan provides institutional-grade reliability for a total cost of approximately ₹500 per month."
        )
      ),

      // Hosting
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "2. Web Hosting Alternatives (The Engine)"),
        React.createElement(View, { style: styles.table },
          React.createElement(View, { style: styles.tableRow },
            React.createElement(View, { style: styles.tableColHeader }, React.createElement(Text, { style: styles.tableCellHeader }, "Provider")),
            React.createElement(View, { style: styles.tableColHeader }, React.createElement(Text, { style: styles.tableCellHeader }, "Cost (Monthly)")),
            React.createElement(View, { style: styles.tableColHeader }, React.createElement(Text, { style: styles.tableCellHeader }, "Pros")),
            React.createElement(View, { style: styles.tableColHeader }, React.createElement(Text, { style: styles.tableCellHeader }, "Best For"))
          ),
          [
            ["Vercel", "₹0", "Fast, Instant setup", "Trial Phase"],
            ["Railway.app", "₹420", "Always Awake, No delay", "Reliable Use"],
            ["Hetzner", "₹350", "Highest Power", "Cost Efficiency"]
          ].map((row, i) => (
            React.createElement(View, { key: i, style: styles.tableRow },
              row.map((cell, j) => (
                React.createElement(View, { key: j, style: styles.tableCol }, React.createElement(Text, { style: styles.tableCell }, cell))
              ))
            )
          ))
        )
      ),

      // Database
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "3. Database Solutions (The Vault)"),
        React.createElement(View, { style: styles.table },
          React.createElement(View, { style: styles.tableRow },
            React.createElement(View, { style: styles.tableColHeader }, React.createElement(Text, { style: styles.tableCellHeader }, "Provider")),
            React.createElement(View, { style: styles.tableColHeader }, React.createElement(Text, { style: styles.tableCellHeader }, "Cost (Monthly)")),
            React.createElement(View, { style: styles.tableColHeader }, React.createElement(Text, { style: styles.tableCellHeader }, "Key Feature")),
            React.createElement(View, { style: styles.tableColHeader }, React.createElement(Text, { style: styles.tableCellHeader }, "Rating"))
          ),
          [
            ["TiDB Cloud", "₹0", "Auto-scaling Serverless", "Recommended"],
            ["DigitalOcean", "₹1,250", "Daily Backups Inc.", "Institutional"],
            ["Railway", "₹250", "Low Latency", "Easy Setup"]
          ].map((row, i) => (
            React.createElement(View, { key: i, style: styles.tableRow },
              row.map((cell, j) => (
                React.createElement(View, { key: j, style: styles.tableCol }, React.createElement(Text, { style: styles.tableCell }, cell))
              ))
            )
          ))
        )
      ),

      // Bundles
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "4. Recommended Deployment Bundles"),
        React.createElement(View, { style: styles.bundleBox },
          React.createElement(Text, { style: styles.bundleTitle }, "Bundle A: The Zero-Risk Starter (₹0/month)"),
          React.createElement(Text, { style: styles.tableCell }, "Includes Vercel Hosting, TiDB Database, and Cloudinary Storage. Best for initial testing.")
        ),
        React.createElement(View, { style: styles.bundleBox },
          React.createElement(Text, { style: styles.bundleTitle }, "Bundle B: The Reliable Institution (~₹500/month)"),
          React.createElement(Text, { style: styles.tableCell }, "Includes Railway Hosting, TiDB Database, and .ac.in Domain. Recommended for live student use.")
        )
      ),

      // Footer
      React.createElement(Text, { style: styles.footer }, "Prepared by KUCET Dev Team | Confidential Institutional Document")
    )
  )
);

async function generate() {
  console.log('Generating PDF...');
  try {
    await ReactPDF.renderToFile(React.createElement(Proposal), `${process.cwd()}/Infrastructure_Proposal_KUCET.pdf`);
    console.log('PDF generated successfully: Infrastructure_Proposal_KUCET.pdf');
  } catch (err) {
    console.error('Error generating PDF:', err);
  }
}

generate();
