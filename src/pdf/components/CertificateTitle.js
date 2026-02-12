import React from "react";
import { Text } from "@react-pdf/renderer";
import { styles } from "./Styles";

export default function CertificateTitle({ text }) {
  return <Text style={styles.title}>{text}</Text>;
}
