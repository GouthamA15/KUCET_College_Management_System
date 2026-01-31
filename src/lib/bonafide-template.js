export const getBonafideTemplate = (data) => {
    const { name, roll_no, father_name, course, academic_year } = data;
    const today = new Date();
    const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    // Note: Puppeteer needs an absolute URL for local assets when rendering HTML.
    // We assume the app is running on localhost:3000 for this.
    // In a production environment, this should be replaced with the actual domain.
    const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://your-production-domain.com' // Replace with your actual domain
        : 'http://localhost:3000';
    const logoUrl = `${baseUrl}/assets/ku-logo.png`;

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Bonafide Certificate</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&family=Roboto&display=swap');
                body {
                    font-family: 'Times New Roman', Times, serif;
                    margin: 0;
                    padding: 0;
                }
                .page {
                    width: 210mm;
                    height: 297mm;
                    padding: 15mm;
                    background: white;
                    box-sizing: border-box;
                    position: relative;
                    border: 1px solid black;
                }
                .certificate-container {
                    border: 2px solid black;
                    padding: 5mm;
                    height: calc(100% - 10mm);
                    display: flex;
                    flex-direction: column;
                    text-align: center;
                }
                .header {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .header-text {
                    color: #000080;
                }
                .header-text h1 {
                    font-size: 24px;
                    margin: 0;
                    font-weight: bold;
                }
                .header-text p {
                    margin: 2px 0;
                    font-size: 14px;
                }
                .header img.logo {
                    width: 80px;
                    height: 80px;
                }
                .title {
                    margin: 20px 0;
                }
                .title h2 {
                    font-size: 22px;
                    font-weight: bold;
                    text-decoration: underline;
                    display: inline-block;
                }
                .content {
                    font-size: 18px;
                    line-height: 1.6;
                    text-align: left;
                    flex-grow: 1;
                    padding: 0 20px;
                }
                .content p {
                    margin: 25px 0;
                }
                .content b {
                    font-weight: bold;
                }
                .footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    padding: 40px 20px 0 20px;
                }
                .footer div {
                    font-size: 16px;
                }
                .footer .principal {
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="certificate-container">
                    <div class="header">
                        <img src="${logoUrl}" alt="College Logo" class="logo">
                        <div class="header-text">
                            <h1>UNIVERSITY COLLEGE OF ENGINEERING</h1>
                            <p>KAKATIYA UNIVERSITY, KOTHAGUDEM - 507101, (TS)</p>
                            <p>(Accredited by NAAC with 'A+' Grade)</p>
                        </div>
                    </div>
                    
                    <div class="title">
                        <h2>BONAFIDE CERTIFICATE</h2>
                    </div>

                    <div class="content">
                        <p>This is to certify that Mr./Ms. <b>${name}</b> S/o / D/o. <b>${father_name}</b> is a bonafide student of this College with bearing Hall Ticket No. <b>${roll_no}</b>, and is studying <b>${course}</b> during the academic year <b>${academic_year}</b>.</p>
                        
                        <p>To the best of our knowledge and belief, he/she bears a good moral character.</p>
                    </div>

                    <div class="footer">
                        <div class="date">
                            <p>Date: ${formattedDate}</p>
                            <p>Place: Kothagudem</p>
                        </div>
                        <div class="principal">
                            <p><b>PRINCIPAL</b></p>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};