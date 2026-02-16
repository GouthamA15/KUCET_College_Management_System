import React from "react";
import { Text, View } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import CertificateWatermark from "../components/CertificateWatermark";
import BaseCertificate from "../components/BaseCertificate";
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
  return (
    <BaseCertificate
      certId={certId}
      date={date}
      logoUrl={logoUrl}
      signatureUrl={signatureUrl}
      qrUrl={qrUrl}
    >
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
    </BaseCertificate>
  );
}
