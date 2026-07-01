import React from "react";
import { View, Image, Text } from "@react-pdf/renderer";
import { styles } from "./Styles";

export default function CertificateHeader({ logoUrl, collegeName, collegeAddress }) {
  return (
    <View>
      <View style={styles.header}>
        {logoUrl ? <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} src={logoUrl} style={styles.logo} alt="College Logo" /> : null}
        <View style={styles.collegeDetails}>
          <Text style={styles.collegeName}>{collegeName}</Text>
          <Text style={styles.collegeAddress}>{collegeAddress}</Text>
        </View>
      </View>
      <View style={styles.hr} />
    </View>
  );
}
