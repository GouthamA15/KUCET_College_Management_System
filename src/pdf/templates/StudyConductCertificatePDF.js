import React from "react";
import { Text, View } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import CertificateWatermark from "../components/CertificateWatermark";
import BaseCertificate from "../components/BaseCertificate";
import { styles } from "../components/Styles";

export default function StudyConductCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  course,
  academicYear,
  conduct,
  logoUrl,
  signatureUrl,
  qrUrl,
}) {
  return (
    <BaseCertificate
      certId={certId}
      date={date}
      logoUrl={logoUrl}
      signatureUrl={signatureUrl}
      qrUrl={qrUrl}
    >
      <CertificateTitle text="STUDY & CONDUCT CERTIFICATE" />

      <View style={styles.content}>
        <Text style={[styles.paragraph, { lineHeight: 1.7, fontSize: 14, textAlign: "justify" }]}>
          This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,
          {" "}S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
          bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
          studied B.Tech in <Text style={styles.bold}>{course}</Text> during
          {" "}<Text style={styles.bold}>{academicYear}</Text>.
          {" "}His/Her conduct and attendance are found to be <Text style={styles.bold}>{conduct}</Text>.
        </Text>
      </View>
    </BaseCertificate>
  );
}
