import React from "react";
import { Text, View } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import BaseCertificate from "../components/BaseCertificate";
import { styles } from "../components/Styles";

export default function BonafideCertificatePDF({
  certId,
  date,
  studentName,
  fatherName,
  admissionNo,
  year,
  semester,
  course,
  academicYear,
  attendancePercentage,
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
      <CertificateTitle text="BONAFIDE CERTIFICATE" />

      <View style={styles.content}>
          <Text style={[styles.paragraph, { lineHeight: 1.7, fontSize: 14, textAlign: "justify" }]}>
          This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text>,
          {" "}S/o., D/o. <Text style={styles.bold}>{fatherName}</Text>{" "}
          bearing Admission No. <Text style={styles.bold}>{admissionNo}</Text>{" "}
          is a Bonafide student of this college studying B.Tech
          {" "}<Text style={styles.bold}>{year}</Text>{" "}Year Semester
          {" "}<Text style={styles.bold}>{semester}</Text>{" "}and
          {" "}branch <Text style={styles.bold}>{course}</Text>{" "}during the academic year
          {" "}<Text style={styles.bold}>{academicYear}</Text>{" "}
          for the purpose of Scholarship. His/her percentage of attendance is
          {" "}<Text style={styles.bold}>{attendancePercentage}</Text>.
        </Text>
      </View>
    </BaseCertificate>
  );
}
