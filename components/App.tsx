import { useContext, useReducer, useState } from "react";
import "../styles/App.css";
import Data from "../components/Data";
import EditorLayout from "./EditorLayout";
import Info from "./Info";
import HomeLayout from "./HomeLayout";
import { ConfigContext, DispatchContext, configReducer, defaultConfig } from "./Context";

function App() {
  const [page, setPage] = useState("data" as Page);
  const [config, dispatch] = useReducer(configReducer, defaultConfig)
  return <ConfigContext.Provider value={config}>
    <DispatchContext.Provider value={dispatch}>
      { page === "home" ? <HomeLayout page={page} setPage={setPage}/> : <EditorLayout page={page} setPage={setPage}>
          { page === "info" ? <Info /> :
            page === "data" ? <Data /> :
            <div></div> }
        </EditorLayout>}
    </DispatchContext.Provider>
  </ConfigContext.Provider>
}

export default App;
