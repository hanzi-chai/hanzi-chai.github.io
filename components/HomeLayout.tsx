import FileExplorer from "./FileExplorer";
import { Page } from "./App";

const HomeLayout = ({ page, setPage }: { page: Page, setPage: (a: Page) => void}) => {
  return <div style={{display: "flex"}}>
    <aside style={{display: "flex", alignItems: "center"}}>
      <FileExplorer page={page} setPage={setPage}/>
    </aside>
    <main style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
      <img src="/favicon.ico" />
      <h1>汉字自动拆分系统</h1>
    </main>
  </div>
}

export default HomeLayout;
