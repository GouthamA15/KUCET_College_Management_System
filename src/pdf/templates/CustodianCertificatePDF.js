import React from "react";
import { Document, Text, View, Image, Font } from "@react-pdf/renderer";
import PageBorder from "../components/PageBorder";
import CertificateHeader from "../components/CertificateHeader";
import CertificateTitle from "../components/CertificateTitle";
import SignatureBlock from "../components/SignatureBlock";
import { styles } from "../components/Styles";

export default function CustodianCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  hallTicket,
  course,
  year,
  semester,
  dob,
  logoUrl,
  stampUrl,
  stampSign,
  signatureUrl,
  qrUrl,
}) {
  // Disable hyphenation globally
  Font.registerHyphenationCallback((word) => [word]);

  return (
    <Document>
      <PageBorder>
        {certId ? <Text style={styles.certId}>Certificate ID: {certId}</Text> : null}

        <CertificateHeader
          logoUrl={logoUrl}
          collegeName={"KU COLLEGE OF ENGINEERING & TECHNOLOGY"}
          collegeAddress={"KAKATIYA UNIVERSITY CAMPUS, WARANGAL – 506 009"}
        />

        {date ? <Text style={styles.date}>Date: {date}</Text> : null}

        <CertificateTitle text="CUSTODIAN CERTIFICATE" />

        <View style={styles.content}>
          <Text style={styles.paragraph}>
            This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text> S/o., D/o. <Text style={styles.bold}>{fatherName}</Text> is a student of this institution studying B.Tech. <Text style={styles.bold}>{year}</Text> Yr. Semester <Text style={styles.bold}>{semester}</Text> in <Text style={styles.bold}>{course}</Text> branch, bearing Hall Ticket No. <Text style={styles.bold}>{hallTicket}</Text> has deposited his/her Original Certificates of:
          </Text>

          <View style={{marginLeft: 30}}>
          <Text style={styles.paragraph}>1. S.S.C. Memorandum</Text>
          <Text style={styles.paragraph}>2. Intermediate Memorandum of Marks & Diploma Certificate</Text>
          <Text style={styles.paragraph}>3. Study Certificate / Bonafide Certificate</Text>
          <Text style={styles.paragraph}>4. Transfer Certificate</Text>
          </View>

          <Text style={styles.paragraph}>
            with this institution at the time of his / her admission and they are in the custody of this Institution.
          </Text>

          <Text style={styles.bold}>
            As per our record his/her date of birth is {dob}
          </Text>
        </View>

        {/* Bottom fixed elements with inline styles as requested */}
        {stampUrl ? (
          <Image
            src={stampUrl}
            style={{ position: "absolute", left: 40, bottom: 50, width: 100, height: 100 }}
          />
        ) : null}

        <View style={{ position: "absolute", left: 0, right: 0, bottom: 50, alignItems: "center", marginRight: 30 }}>
          {qrUrl ? <Image src={qrUrl} style={{ width: 60, height: 60}} /> : null}
          <Text style={styles.qrLabel}>SCAN TO VERIFY</Text>
        </View>

        <View style={styles.custodianSignSection}>
          <Image src={stampSign} style={styles.stampSign} />        
          <Text style={styles.signatureLabel}>PRINCIPAL</Text> 
        </View>  
      
      
      </PageBorder>
    </Document>
  );
}
