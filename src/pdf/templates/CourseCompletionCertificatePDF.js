import React from "react";
import { Text, View } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import CertificateWatermark from "../components/CertificateWatermark";
import BaseCertificate from "../components/BaseCertificate";
import { styles } from "../components/Styles";

export default function CourseCompletionCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  course,
  batch,
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
      <CertificateTitle text="COURSE COMPLETION CERTIFICATE" />

      <View style={styles.content}>
        <CertificateWatermark imageUrl={logoUrl} />
        <Text style={[styles.paragraph, { lineHeight: 1.7, fontSize: 14, textAlign: "justify" }]}>
          This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,
          {" "}S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
          bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
          has successfully completed the B.Tech <Text style={styles.bold}>{course}</Text>{" "}
          course from this college during the batch <Text style={styles.bold}>{batch}</Text>.
        </Text>
        <Text style={[styles.paragraph, { marginTop: 20 }]}>
          During the course of his/her stay in the college, his/her conduct and character have been found to be <Text style={styles.bold}>Satisfactory</Text>.
        </Text>
      </View>
    </BaseCertificate>
  );
}
