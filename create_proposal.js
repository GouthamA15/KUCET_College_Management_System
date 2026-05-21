const fs = require('fs');
const path = require('path');

const downloadPath = path.join(process.env.USERPROFILE, 'Downloads', 'KUCET_CMS_Proposal.txt');
const content = `KUCET / [DEPARTMENT NAME] / PROPOSAL-2026-118

To,
The Principal,
KUCET (Kakatiya University College of Engineering and Technology),
Warangal.

Date: May 21, 2026

Subject: Proposal for Professional Production Hosting & Digital Transformation of Student Records (Admissions, Fees, and Scholarships).

Respected Sir,

Following the successful completion and internal testing of the KUCET College Management System (CMS), our development team is now prepared to transition the platform into a live institutional environment. To support the heavy administrative load of 2,000+ students—particularly during peak admission and attendance windows—we require a dedicated KVM 2 High-Performance Virtual Private Server (VPS).

1. Executive Summary of Improvements
The CMS replaces manual, paper-heavy processes with a high-security digital registry. Our current shared hosting (cPanel) is insufficient for these high-stakes operations. The proposed dedicated infrastructure will host the following mission-critical modules:

* A. Advanced Admissions & Registry: 
    - Automated institutional roll-number generation (Year + Branch + Serial).
    - Digital verification pipeline for student documents (SSC, Inter, Caste).
    - Instant "Excel Migration Export" for university-level data submission.
* B. Automated Scholarship Governance: 
    - Elimination of duplicate records through strict application number validation.
    - Auto-Propagation: Entering a scholarship ID for one year automatically syncs it across all academic years for that student.
* C. Financial & Fee Management: 
    - Real-time year-wise fee tracking with built-in UPI/QR payment integration.
    - Automated "Scholarship Impact" calculations (Adjusting dues automatically based on sanctioned scholarship amounts).

2. Technical Specifications of the Dedicated Server
To ensure the system remains 100% stable during high-traffic windows, we have selected a Hostinger KVM 2 VPS configuration:

* Processing Power: 2 Dedicated vCPU Cores.
* Memory (RAM): 8 GB Dedicated RAM.
* Storage: 100 GB NVMe SSD.
* Security: AES-256-GCM Encryption & Automated daily off-site backups.

3. Annual Budget Requirements

| Component | Description | Annual Estimated Cost |
| :--- | :--- | :--- |
| Dedicated Hosting | Hostinger KVM 2 VPS (8GB RAM / 2 vCPU) | ₹9,600 |
| Institutional DNS | .ac.in Domain Maintenance & ERNET Renewal | ₹1,000 |
| Security Certificate | SSL Restoration (HTTPS) for kucet.ac.in | ₹500 |
| Technical Buffer | Off-site Storage & Emergency Scaling | ₹400 |
| TOTAL ANNUAL COST | | ₹11,500 |

4. Immediate Action Required (Technical Blocker)
To go live at the official subdomain cms.kucet.ac.in, the technical team requires coordination with the college’s IT administrator for access to the GoDaddy DNS Management panel to add an "A Record" pointing to our new dedicated server.

5. Conclusion
The implementation of this CMS on dedicated hardware is a move toward a "Paperless Campus." It provides the Principal’s office with a real-time "Audit Trail" of every fee paid and every scholarship sanctioned, ensuring total transparency.

We request your kind approval for the budget of ₹11,500 to secure this infrastructure for the current academic session.

Sincerely,

[Your Name]
Lead Developer, KUCET CMS Team`;

try {
    fs.writeFileSync(downloadPath, content);
    console.log('File successfully created at: ' + downloadPath);
} catch (err) {
    console.error('Error creating file:', err);
}
