import React from "react";
import { Document, Text, View, Font } from "@react-pdf/renderer";
import PageBorder from "../components/PageBorder";
import CertificateHeader from "../components/CertificateHeader";
import CertificateTitle from "../components/CertificateTitle";
import CertificateWatermark from "../components/CertificateWatermark";
import SignatureBlock from "../components/SignatureBlock";
import QRBlock from "../components/QRBlock";
import { styles } from "../components/Styles";

export default function TransferCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  course,
  batch,
  conduct,
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

        <CertificateTitle text="TRANSFER CERTIFICATE" />

        <View style={styles.content}>
          <CertificateWatermark imageUrl={logoUrl} />
          <Text style={[styles.paragraph, { lineHeight: 1.7, fontSize: 14, textAlign: "justify" }]}>
            This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,
            {" "}S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
            bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
            was a bonafide student of B.Tech <Text style={styles.bold}>{course}</Text>{" "}
            course at this college during the batch <Text style={styles.bold}>{batch}</Text>.
          </Text>
          
          <Text style={[styles.paragraph, { marginTop: 20 }]}>
            He/She has left the institution with the reason: <Text style={styles.bold}>{reason || "Completion of Course"}</Text>.
          </Text>

          <Text style={[styles.paragraph, { marginTop: 20 }]}>
            During his/her stay in this college, his/her conduct and character were found to be <Text style={styles.bold}>{conduct || "Satisfactory"}</Text>.
          </Text>
        </View>

        <SignatureBlock signatureUrl={signatureUrl} />

        <QRBlock qrUrl={qrUrl} />
      </PageBorder>
    </Document>
  );
}
