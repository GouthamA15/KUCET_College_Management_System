import React from "react";
import { View, Image, Text } from "@react-pdf/renderer";
import { styles } from "./Styles";

export default function SignatureBlock({ signatureUrl, label = "PRINCIPAL", imageStyle }) {
  return (
    <View style={styles.signatureSection}>
      {signatureUrl ? (
        <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} 
          src={signatureUrl} 
          style={imageStyle || styles.signatureImage} 
          alt="Principal Signature" 
        />
      ) : null}
      <Text style={styles.signatureLabel}>{label}</Text>
    </View>
  );
}
