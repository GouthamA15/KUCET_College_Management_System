import React from "react";
import { Text, View, Image } from "@react-pdf/renderer";
import CertificateTitle from "../components/CertificateTitle";
import BaseCertificate from "../components/BaseCertificate";
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
  return (
    <BaseCertificate
      certId={certId}
      date={date}
      logoUrl={logoUrl}
      signatureUrl={stampSign || signatureUrl}
      qrUrl={qrUrl}
    >
      <CertificateTitle text="CUSTODIAN CERTIFICATE" />

      <View style={styles.content}>
        <Text style={styles.paragraph}>
          This is to certify that Mr./Ms. <Text style={styles.bold}>{studentName}</Text> S/o., D/o. <Text style={styles.bold}>{fatherName}</Text> is a student of this institution studying B.Tech. <Text style={styles.bold}>{year}</Text> Yr. Semester <Text style={styles.bold}>{semester}</Text> in <Text style={styles.bold}>{course}</Text> branch, bearing Hall Ticket No. <Text style={styles.bold}>{hallTicket}</Text> has deposited his/her Original Certificates of:
        </Text>

        <View style={{marginLeft: 30, marginTop: 10, marginBottom: 10}}>
          <Text style={styles.paragraph}>1. S.S.C. Memorandum</Text>
          <Text style={styles.paragraph}>2. Intermediate Memorandum of Marks & Diploma Certificate</Text>
          <Text style={styles.paragraph}>3. Study Certificate / Bonafide Certificate</Text>
          <Text style={styles.paragraph}>4. Transfer Certificate</Text>
        </View>

        <Text style={styles.paragraph}>
          with this institution at the time of his / her admission and they are in the custody of this Institution.
        </Text>

        <Text style={[styles.bold, { marginTop: 15 }]}>
          As per our record his/her date of birth is {dob}
        </Text>
      </View>

      {/* College Seal - Optional and positioned carefully to not clash with QR */}
      {stampUrl ? (
        <Image 
          src={stampUrl}
          style={{ position: "absolute", left: 120, bottom: 40, width: 80, height: 80 }}
        />
      ) : null}
    </BaseCertificate>
  );
}
