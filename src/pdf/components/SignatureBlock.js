import React from "react";
import { View, Image, Text } from "@react-pdf/renderer";
import { styles } from "./Styles";

export default function SignatureBlock({ signatureUrl, label = "PRINCIPAL" }) {
  return (
    <View style={styles.signatureSection}>
      {signatureUrl ? <Image src={signatureUrl} style={styles.signatureImage} /> : null}
      <Text style={styles.signatureLabel}>{label}</Text>
    </View>
  );
}
