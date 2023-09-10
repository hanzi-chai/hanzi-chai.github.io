import { useState } from "react";
import "../styles/App.css";
import Data from "../components/Data";

function App() {
  const [page, setPage] = useState(2);
  // 0 -> home
  // 1 -> ?
  // 2 -> data

  return (
    <>
      <h1>汉字自动拆分系统</h1>;
      { page === 2 ? <Data /> : <div></div>}
    </>
  );
}

export default App;
