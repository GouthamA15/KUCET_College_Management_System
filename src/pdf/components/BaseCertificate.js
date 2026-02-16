import React from "react";
import { Document, Text, Font } from "@react-pdf/renderer";
import PageBorder from "./PageBorder";
import CertificateHeader from "./CertificateHeader";
import SignatureBlock from "./SignatureBlock";
import QRBlock from "./QRBlock";
import CertificateWatermark from "./CertificateWatermark";
import { styles } from "./Styles";
import { COLLEGE_CONFIG } from "@/lib/college-config";

// Disable automatic word hyphenation globally
Font.registerHyphenationCallback((word) => [word]);

export default function BaseCertificate({
  certId,
  date,
  logoUrl,
  signatureUrl,
  qrUrl,
  showWatermark = true,
  children
}) {
  return (
    <Document>
      <PageBorder>
        {certId ? <Text style={styles.certId}>Certificate ID: {certId}</Text> : null}

        <CertificateHeader
          logoUrl={logoUrl}
          collegeName={COLLEGE_CONFIG.name}
          collegeAddress={COLLEGE_CONFIG.address}
        />

        {date ? <Text style={styles.date}>Date: {date}</Text> : null}

        {showWatermark && <CertificateWatermark imageUrl={logoUrl} />}

        {children}

        <SignatureBlock signatureUrl={signatureUrl} />

        <QRBlock qrUrl={qrUrl} />
      </PageBorder>
    </Document>
  );
}
