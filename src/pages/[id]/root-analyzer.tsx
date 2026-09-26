import { Suspense } from "react";
import { Skeleton } from "antd";
import RootAdditionAnalyzer from "~/components/RootAdditionAnalyzer";
import { useChaifenTitle } from "~/utils";

export default function RootAnalyzerPage() {
  useChaifenTitle("加根分析");
  return (
    <Suspense fallback={<Skeleton active />}>
      <RootAdditionAnalyzer />
    </Suspense>
  );
}
