import { Flex } from "antd";
import { useAtomValue } from "jotai";
import { repertoireTypeAtom } from "~/atoms";
import CharacterTable from "~/components/CharacterTable";
import GlyphTable from "~/components/GlyphTable";
import { useChaifenTitle } from "~/utils";

export default function Repertoire() {
  useChaifenTitle("数据");
  const repertoireType = useAtomValue(repertoireTypeAtom);
  return (
    <Flex vertical gap="middle" className="h-full">
      {repertoireType === "character" ? <CharacterTable /> : <GlyphTable />}
    </Flex>
  );
}
