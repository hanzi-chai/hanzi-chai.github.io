import { Flex } from "antd";
import { RemoteContext } from "~/components/Action";
import CharacterTable from "~/components/CharacterTable";
import { useChaifenTitle } from "~/components/Utils";

export default () => {
  useChaifenTitle("字形数据");
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <RemoteContext.Provider value={false}>
        <CharacterTable />
      </RemoteContext.Provider>
    </Flex>
  );
};
