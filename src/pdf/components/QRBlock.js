import React from "react";
import { View, Image, Text } from "@react-pdf/renderer";
import { styles } from "./Styles";

export default function QRBlock({ qrUrl, label = "SCAN TO VERIFY" }) {
  return (
    <View style={styles.qrSection}>
      {qrUrl ? <Image src={qrUrl} style={styles.qrImage} /> : null}
      <Text style={styles.qrLabel}>{label}</Text>
    </View>
  );
}
