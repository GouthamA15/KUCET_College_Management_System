import React from "react";
import { Document, Text, View, Font } from "@react-pdf/renderer";
import PageBorder from "../components/PageBorder";
import CertificateHeader from "../components/CertificateHeader";
import CertificateTitle from "../components/CertificateTitle";
import CertificateWatermark from "../components/CertificateWatermark";
import SignatureBlock from "../components/SignatureBlock";
import QRBlock from "../components/QRBlock";
import { styles } from "../components/Styles";

export default function MigrationCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  course,
  academicYear,
  reason,
  logoUrl,
  signatureUrl,
  qrUrl,
}) {
  // Disable automatic word hyphenation globally for this document
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

        <CertificateTitle text="MIGRATION CERTIFICATE" />

        <View style={styles.content}>
          <CertificateWatermark imageUrl={logoUrl}  />
          <Text style={[styles.paragraph, { lineHeight: 1.7, fontSize: 14, textAlign: "justify" }]}>
            This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,
            {" "}S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
            bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
            of B.Tech <Text style={styles.bold}>{course}</Text> during
            {" "}<Text style={styles.bold}>{academicYear}</Text>, is issued this certificate to facilitate migration.
            {" "}Reason stated: <Text style={styles.bold}>{reason}</Text>.
          </Text>
        </View>

        <SignatureBlock signatureUrl={signatureUrl} />

        <QRBlock qrUrl={qrUrl} />
      </PageBorder>
    </Document>
  );
}
