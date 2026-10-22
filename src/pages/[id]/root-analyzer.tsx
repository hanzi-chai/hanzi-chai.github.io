import { Suspense } from "react";
import { Skeleton } from "antd";
import { useAtomValue } from "jotai";
import { 方案序列号原子 } from "~/atoms";
import RootAdditionAnalyzer from "~/components/RootAdditionAnalyzer";
import { useChaifenTitle } from "~/utils";

export default function RootAnalyzerPage() {
  useChaifenTitle("智能选根");
  // 换方案时强制重挂：自动搜索参数存在各方案 yaml 的 autoselect 块里，而 useState 只在首次挂载初始化，
  // 不重挂会把上一个方案的参数写进新方案。
  const 方案 = useAtomValue(方案序列号原子);
  return (
    <Suspense fallback={<Skeleton active />}>
      <RootAdditionAnalyzer key={方案} />
    </Suspense>
  );
}
