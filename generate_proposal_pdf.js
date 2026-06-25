const React = require('react');
const ReactPDF = require('@react-pdf/renderer');
const { Document, Page, Text, View, StyleSheet, _Font } = ReactPDF;

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica', color: '#333' },
  header: { marginBottom: 15, borderBottom: '2pt solid #0b3578', paddingBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0b3578' },
  subtitle: { fontSize: 10, color: '#666', marginTop: 4 },
  section: { marginTop: 15, marginBottom: 5 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#0b3578', marginBottom: 8, textTransform: 'uppercase', backgroundColor: '#f0f4f8', padding: 4 },
  table: { display: 'table', width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#bfbfbf', marginBottom: 10 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableHeader: { backgroundColor: '#0b3578' },
  headerText: { color: 'white', fontWeight: 'bold', padding: 5, fontSize: 8 },
  cellText: { padding: 5, fontSize: 8 },
  col1: { width: '15%' }, col2: { width: '15%' }, col3: { width: '30%' }, col4: { width: '25%' }, col5: { width: '15%' },
  bundleBox: { backgroundColor: '#f9fafb', padding: 10, borderRadius: 5, border: '1pt solid #e5e7eb', marginBottom: 8 },
  bundleTitle: { fontWeight: 'bold', color: '#0b3578', fontSize: 10, marginBottom: 3 },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, textAlign: 'center', color: '#999', fontSize: 8, borderTop: '1pt solid #eee', paddingTop: 10 }
});

const Proposal = () => (
  React.createElement(Document, { /* empty */ },
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.title }, "Infrastructure Cost & Feature Analysis"),
        React.createElement(Text, { style: styles.subtitle }, "KUCET CMS | Date: March 13, 2026")
      ),

      // Section 1: Hosting
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "1. Web Application Hosting (The Engine)"),
        React.createElement(View, { style: styles.table },
          React.createElement(View, { style: [styles.tableRow, styles.tableHeader] },
            ["Provider", "Monthly", "Pros", "Cons", "Best For"].map((h, i) => 
              React.createElement(View, { key: i, style: styles[`col${i+1}`] }, React.createElement(Text, { style: styles.headerText }, h)))
          ),
          [
            ["Vercel", "₹0", "Fast performance; best for Next.js", "Cold Starts; Non-commercial only", "Trial Phase"],
            ["Railway.app", "₹420", "Always Awake; No delays; Team access", "Requires credit card; Paid daily", "Reliable Use"],
            ["Render.com", "₹580", "Stable; Separate API/Frontend", "Free tier spins down (30s wake)", "Secondary"],
            ["Hetzner VPS", "₹350", "Most power (4GB RAM); Full server", "High technical skill required", "Efficiency"],
            ["AWS Amplify", "Pay-as-go", "Unlimited scaling; Global standard", "Complex pricing; unexpected bills", "Govt. Scale"]
          ].map((row, i) => (
            React.createElement(View, { key: i, style: styles.tableRow },
              row.map((c, j) => React.createElement(View, { key: j, style: styles[`col${j+1}`] }, React.createElement(Text, { style: styles.cellText }, c)))
            )
          ))
        )
      ),

      // Section 2: Database
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "2. Database Solutions (The Vault)"),
        React.createElement(View, { style: styles.table },
          React.createElement(View, { style: [styles.tableRow, styles.tableHeader] },
            ["Provider", "Monthly", "Pros", "Cons", "Best For"].map((h, i) => 
              React.createElement(View, { key: i, style: styles[`col${i+1}`] }, React.createElement(Text, { style: styles.headerText }, h)))
          ),
          [
            ["TiDB Cloud", "₹0", "5GB storage; Auto-scaling", "Slight latency (~50ms) due to region", "Max Savings"],
            ["Aiven.io", "₹0", "High reliability; Dedicated MySQL", "Limited to 1 CPU / 1GB RAM", "Small batches"],
            ["DigitalOcean", "₹1,250", "Daily Backups; Private networking", "High fixed cost for small college", "Inst. Std."],
            ["PlanetScale", "₹3,200", "Handles billions of rows", "Most expensive option; Overkill", "Univ. Level"]
          ].map((row, i) => (
            React.createElement(View, { key: i, style: styles.tableRow },
              row.map((c, j) => React.createElement(View, { key: j, style: styles[`col${j+1}`] }, React.createElement(Text, { style: styles.cellText }, c)))
            )
          ))
        )
      ),

      // Section 3: Storage
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "3. Image & Document Storage (The Archive)"),
        React.createElement(View, { style: styles.table },
          React.createElement(View, { style: [styles.tableRow, styles.tableHeader] },
            ["Provider", "Capacity", "Cost", "Pros", "Cons"].map((h, i) => 
              React.createElement(View, { key: i, style: styles[`col${i+1}`] }, React.createElement(Text, { style: styles.headerText }, h)))
          ),
          [
            ["Cloudinary", "25 GB", "₹0", "Auto-optimizes images", "Paid plans are very expensive", ""],
            ["Supabase", "5 GB", "₹0", "Simple, secure, and fast", "No image resizing in free tier", ""],
            ["Cloudflare R2", "10 GB", "₹0", "No Bandwidth Costs", "Requires domain on Cloudflare", ""],
            ["AWS S3", "5 GB", "₹80", "The 'Gold Standard' for security", "Complex permissions setup", ""]
          ].map((row, i) => (
            React.createElement(View, { key: i, style: styles.tableRow },
              row.map((c, j) => React.createElement(View, { key: j, style: styles[`col${j+1}`] }, React.createElement(Text, { style: styles.cellText }, c)))
            )
          ))
        )
      ),

      // Section 4: Domain
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "4. Domain & Security (The Identity)"),
        React.createElement(View, { style: styles.table },
          React.createElement(View, { style: [styles.tableRow, styles.tableHeader] },
            ["Extension", "Provider", "Annual Cost", "Rationale", ""].map((h, i) => 
              React.createElement(View, { key: i, style: i===3 ? {width:'40%'} : styles[`col${i+1}`] }, React.createElement(Text, { style: styles.headerText }, h)))
          ),
          [
            [".ac.in", "ERNET India", "₹1,000", "Mandatory for Trust; Official Govt ID", ""],
            [".in", "Cloudflare", "₹599", "Cheapest/Fastest; No paperwork", ""],
            ["SSL / WAF", "Cloudflare", "FREE", "Essential; Blocks DDoS attacks", ""]
          ].map((row, i) => (
            React.createElement(View, { key: i, style: styles.tableRow },
              row.map((c, j) => React.createElement(View, { key: j, style: j===3 ? {width:'40%'} : styles[`col${j+1}`] }, React.createElement(Text, { style: styles.cellText }, c)))
            )
          ))
        )
      ),

      // Section 5: Bundles
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "5. Proposed Bundles for the Principal"),
        [
          { t: "Level A: The Zero-Risk Starter (Month 1)", c: "₹0/mo | ₹1,000 Setup", d: "Vercel + TiDB + Cloudinary + .ac.in" },
          { t: "Level B: The Reliable Institution (Long Term)", c: "₹500/mo | ₹1,000 Setup", d: "Railway + TiDB + Cloudinary + .ac.in" },
          { t: "Level C: The Self-Hosted Powerhouse", c: "₹435/mo | ₹1,000 Setup", d: "Hetzner VPS (All-in-one) + Cloudflare R2 + .ac.in" }
        ].map((b, i) => (
          React.createElement(View, { key: i, style: styles.bundleBox },
            React.createElement(Text, { style: styles.bundleTitle }, b.t),
            React.createElement(Text, { style: {fontSize: 8} }, `${b.c} — ${b.d}`)
          )
        ))
      ),

      // Section 6: Benefits
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "6. Final Summary of Benefits"),
        React.createElement(Text, { style: styles.cellText }, "By investing in Level B (~₹500/month), KUCET will receive:\n1. High Speed access for students on all networks.\n2. 24/7 Availability with no 'sleep' modes.\n3. Data Safety with global mirroring.\n4. Professional Identity via official .ac.in domain.")
      ),

      React.createElement(Text, { style: styles.footer }, "Prepared by KUCET Dev Team | Page 1 of 1")
    )
  )
);

async function generate() {
  try {
    await ReactPDF.renderToFile(React.createElement(Proposal), `${process.cwd()}/Infrastructure_Proposal_KUCET.pdf`);
    console.info('PDF generated successfully.');
  } catch (err) {
    console.error('Error:', err);
  }
}
generate();
