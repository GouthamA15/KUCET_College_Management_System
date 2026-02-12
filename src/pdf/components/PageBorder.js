import React from "react";
import { Page, View } from "@react-pdf/renderer";
import { styles } from "./Styles";

export default function PageBorder({ children }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.container}>{children}</View>
    </Page>
  );
}
