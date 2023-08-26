import React from "react";
import { Metadata } from "next";
import DataPage from "./component";

export const metadata: Metadata = {
  title: "汉字自动拆分系统",
  description: "汉字自动拆分系统",
  viewport: "width=device-width, initial-scale=1",
};

export default function Page() {
  return (
    <DataPage />
  );
}
