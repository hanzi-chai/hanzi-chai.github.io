import {
  Flex
} from "antd";
import { RemoteContext } from "~/components/Action";
import FormTable from "~/components/FormTable";

const FormData = () => {
  return (
    <Flex vertical gap="middle" style={{ height: "100%" }}>
      <RemoteContext.Provider value={false}>
        <FormTable />
      </RemoteContext.Provider>
    </Flex>
  );
};

export default FormData;
