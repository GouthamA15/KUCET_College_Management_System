import React from "react";
import { Text, View } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import CertificateWatermark from "../components/CertificateWatermark";
import BaseCertificate from "../components/BaseCertificate";
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
  return (
    <BaseCertificate
      certId={certId}
      date={date}
      logoUrl={logoUrl}
      signatureUrl={signatureUrl}
      qrUrl={qrUrl}
    >
      <CertificateTitle text="TRANSFER CERTIFICATE" />

      <View style={styles.content}>
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
    </BaseCertificate>
  );
}
