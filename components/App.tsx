import { useEffect, useReducer, useState } from "react";
import Data from "../components/Data";
import EditorLayout from "./EditorLayout";
import Info from "./Info";
import HomeLayout from "./HomeLayout";
import { ConfigContext, DispatchContext, configReducer } from "./Context";
import Rule from "./Rules";
import Roots from "./Roots";
import Result from "./Result";
import defaultConfig from "../default.yaml";
import { Config } from "../lib/chai";

export type Page = "home" | "info" | "data" | "rule" | "root" | "result";

export interface GlobalProps {
  page: string;
  setPage: (s: Page) => void;
  configs: Config[];
  setConfigs: (cs: Config[]) => void;
}

function App() {
  const [page, setPage] = useState("home" as Page);
  const [configs, setConfigs] = useState([] as Config[]);
  const [config, dispatch] = useReducer(configReducer, defaultConfig as Config);

  // read previous data
  useEffect(() => {
    const savedConfigs = [] as Config[];
    for (let i = 0; i != localStorage.length; ++i) {
      const key = localStorage.key(i)!;
      const data = JSON.parse(localStorage.getItem(key)!);
      savedConfigs.push(data);
    }
    setConfigs(savedConfigs);
  }, []);

  // write current data
  useEffect(() => {
    for (const config of configs) {
      localStorage.setItem(config.info.id, JSON.stringify(config))
    }
  }, [configs])

  const globalProps: GlobalProps = { page, setPage, configs, setConfigs };
  return (
    <ConfigContext.Provider value={config}>
      <DispatchContext.Provider value={dispatch}>
        {page === "home" ? (
          <HomeLayout {...globalProps} />
        ) : (
          <EditorLayout {...globalProps}>
            {page === "info" ? (
              <Info />
            ) : page === "data" ? (
              <Data />
            ) : page === "rule" ? (
              <Rule />
            ) : page === "root" ? (
              <Roots />
            ) : page === "result" ? (
              <Result />
            ) : (
              <div></div>
            )}
          </EditorLayout>
        )}
      </DispatchContext.Provider>
    </ConfigContext.Provider>
  );
}

export default App;
