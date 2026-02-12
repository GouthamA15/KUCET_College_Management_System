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

export default function CourseCompletionCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  course,
  batch,
  aggCgpa,
  year,
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

        <CertificateTitle text="COURSE COMPLETION CERTIFICATE" />

        <View style={styles.content}>
          <CertificateWatermark imageUrl={logoUrl} />
          <Text style={[styles.paragraph, { lineHeight: 1.7, fontSize: 14, textAlign: "justify" }]}>
            This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,
            {" "}S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
            bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
            is a Bonafide student of this institution and studied B.Tech in
            {" "}<Text style={styles.bold}>{course}</Text>{" "}Branch during the academic year
            {" "}<Text style={styles.bold}>{batch}</Text>.
            {"\n\n"}
            He has fulfilled the requirements of the course/program and completed his final examination for which the results are also declared. He has no standing backlogs and his aggregate CGPA - <Text style={styles.bold}>{aggCgpa}</Text>.
            {" "}His Certificates are under process and will be issued in the first week of July <Text style={styles.bold}>{year}</Text>.
            {"\n"}
            This Certificate is issued with reference to his application dated <Text style={styles.bold}>{date}</Text>.
          </Text>
        </View>

        <SignatureBlock signatureUrl={signatureUrl} />

        <QRBlock qrUrl={qrUrl} />
      </PageBorder>
    </Document>
  );
}
