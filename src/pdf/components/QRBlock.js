import React from "react";
import { View, Image, Text } from "@react-pdf/renderer";
import { styles } from "./Styles";

export default function QRBlock({ qrUrl, label = "SCAN TO VERIFY", style }) {
  return (
    <View style={style || styles.qrSection}>
      {qrUrl ? <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} src={qrUrl} style={styles.qrImage} alt="QR Code" /> : null}
      <Text style={styles.qrLabel}>{label}</Text>
    </View>
  );
}
