import { SearchOutlined } from "@ant-design/icons";
import {
  Button,
  Checkbox,
  Flex,
  Input,
  Modal,
  Pagination,
  Typography,
} from "antd";
import type { 元素, 字符 } from "hanzi-chai";
import { atomWithStorage } from "jotai/utils";
import { useState } from "react";
import { useAtom, useAtomValue, 原始字库原子, 如字库原子 } from "~/atoms";
import { 字符字形过滤器 } from "~/utils";
import Classifier from "./Classifier";
import { CharacterWithTooltip } from "./Utils";

const 使用康熙部首原子 = atomWithStorage("使用康熙部首", false);
const 使用部首补充原子 = atomWithStorage("使用部首补充", false);
const 相似字根推荐原子 = atomWithStorage("相似字根推荐", true);

export default function ElementPool({
  type,
  content,
}: {
  type: string;
  content: 元素[];
}) {
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [input, setInput] = useState("");
  const 原始字库 = useAtomValue(原始字库原子);
  const 字库 = useAtomValue(如字库原子);
  const [isOpen, setOpen] = useState(false);
  const 笔顺过滤 = new 字符字形过滤器({ sequence: input });
  const 直接过滤 = new 字符字形过滤器({ name: input });
  const [显示康熙部首, 设置康熙部首] = useAtom(使用康熙部首原子);
  const [显示部首补充, 设置部首补充] = useAtom(使用部首补充原子);
  const [推荐相似字根, 设置推荐相似字根] = useAtom(相似字根推荐原子);
  const filtered =
    type === "字根"
      ? content.filter((元素) => {
          const ch = 元素 as 字符;
          if (!显示康熙部首 && ch.区块() === "kangxi") return false;
          if (!显示部首补充 && ch.区块() === "radicals-sup") return false;
          const data = 原始字库.查询(ch);
          if (!data) return false;
          return (
            笔顺过滤.过滤字符(ch, data, 字库) ||
            直接过滤.过滤字符(ch, data, 字库)
          );
        })
      : content;
  const range = filtered.slice((page - 1) * pageSize, page * pageSize);
  return (
    <Flex vertical gap="middle" align="center">
      {type === "字根" && (
        <>
          <Flex align="baseline" justify="center">
            显示康熙部首：
            <Checkbox
              checked={显示康熙部首}
              onChange={(e) => 设置康熙部首(e.target.checked)}
            />
            &nbsp; 显示部首补充：
            <Checkbox
              checked={显示部首补充}
              onChange={(e) => 设置部首补充(e.target.checked)}
            />
          </Flex>
          <Flex>
            推荐相似字根：
            <Checkbox
              checked={推荐相似字根}
              onChange={(e) => 设置推荐相似字根(e.target.checked)}
            />
          </Flex>
          <Input
            placeholder="输入笔画（12345）或汉字搜索"
            onChange={(event) => {
              setInput(event.target.value);
            }}
            prefix={<SearchOutlined />}
          />
        </>
      )}
      {type === "笔画" && (
        <>
          <Typography.Text>
            您需要首先将笔画分为若干个类别，然后将代表类别的数字放到键盘上。
          </Typography.Text>
          <Button onClick={() => setOpen(true)}>配置笔画分类</Button>
          <Modal
            open={isOpen}
            title="笔画分类"
            footer={false}
            onCancel={() => setOpen(false)}
          >
            <Classifier />
          </Modal>
        </>
      )}
      <Flex wrap="wrap" className="p-2 border border-black w-full">
        {range.map((x) => (
          <CharacterWithTooltip key={JSON.stringify(x)} element={x} />
        ))}
      </Flex>
      {filtered.length > pageSize && (
        <Pagination
          current={page}
          onChange={(page) => {
            setPage(page);
          }}
          showSizeChanger={false}
          total={filtered.length}
          pageSize={pageSize}
        />
      )}
    </Flex>
  );
}
