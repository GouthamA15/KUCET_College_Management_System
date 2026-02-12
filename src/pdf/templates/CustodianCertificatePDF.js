import React from "react";
import { Document, Text, View } from "@react-pdf/renderer";
import { Font } from "@react-pdf/renderer";
import PageBorder from "../components/PageBorder";
import CertificateHeader from "../components/CertificateHeader";
import CertificateTitle from "../components/CertificateTitle";
import CertificateWatermark from "../components/CertificateWatermark";
import SignatureBlock from "../components/SignatureBlock";
import QRBlock from "../components/QRBlock";
import { styles } from "../components/Styles";

export default function CustodianCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  course,
  academicYear,
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

        <CertificateTitle text="CUSTODIAN CERTIFICATE" />

        <View style={styles.content}>
          <CertificateWatermark imageUrl={logoUrl} />
          <Text style={[styles.paragraph, { lineHeight: 1.7, fontSize: 14, textAlign: "justify" }]}>
            This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,
            {" "}S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
            bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
            of B.Tech <Text style={styles.bold}>{course}</Text>, academic year
            {" "}<Text style={styles.bold}>{academicYear}</Text>, has submitted all required documents to the college.
            {" "}The institution is the custodian of the submitted originals as per university regulations.
          </Text>
        </View>

        <SignatureBlock signatureUrl={signatureUrl} />

        <QRBlock qrUrl={qrUrl} />
      </PageBorder>
    </Document>
  );
}
