import { Flex } from "antd";
import CharacterTable from "~/components/CharacterTable";
import { useChaifenTitle } from "~/utils";

export default function Repertoire() {
  useChaifenTitle("数据");
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <CharacterTable />
    </Flex>
  );
}
