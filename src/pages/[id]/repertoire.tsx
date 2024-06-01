import { Flex } from "antd";
import { RemoteContext, useChaifenTitle } from "~/atoms";
import CharacterTable from "~/components/CharacterTable";

export default () => {
  useChaifenTitle("数据");
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <RemoteContext.Provider value={false}>
        <CharacterTable />
      </RemoteContext.Provider>
    </Flex>
  );
};
