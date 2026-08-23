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
import { type 元素, 复合体, 字符, 部件 } from "hanzi-chai";
import { atomWithStorage } from "jotai/utils";
import { useState } from "react";
import { useAtom, useAtomValue, 字库原子, 字形字符映射原子 } from "~/atoms";
import { 字符字形过滤器 } from "~/utils";
import Classifier from "./Classifier";
import { CharacterWithTooltip } from "./Utils";

const 使用康熙部首原子 = atomWithStorage("使用康熙部首", false);
const 使用部首补充原子 = atomWithStorage("使用部首补充", false);
const 相似字根推荐原子 = atomWithStorage("相似字根推荐", true);
const 隐藏旧版私用区原子 = atomWithStorage("隐藏旧版私用区", true);
const 隐藏可被字符唯一对应的字形元素 = atomWithStorage(
  "隐藏可被字符唯一对应的字形元素",
  true,
);

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
  const 字库 = useAtomValue(字库原子);
  const [isOpen, setOpen] = useState(false);
  const 笔顺过滤 = new 字符字形过滤器({ sequence: input });
  const 直接过滤 = new 字符字形过滤器({ name: input });
  const [显示康熙部首, 设置康熙部首] = useAtom(使用康熙部首原子);
  const [显示部首补充, 设置部首补充] = useAtom(使用部首补充原子);
  const [推荐相似字根, 设置推荐相似字根] = useAtom(相似字根推荐原子);
  const [隐藏旧版私用区, 设置隐藏旧版私用区] = useAtom(隐藏旧版私用区原子);
  const [隐藏可被字符唯一对应的字形, 设置隐藏可被字符唯一对应的字形] = useAtom(
    隐藏可被字符唯一对应的字形元素,
  );
  const 字形字符映射 = useAtomValue(字形字符映射原子);
  let filtered = content;
  if (type === "字根") {
    filtered = content.filter((元素) => {
      if (元素 instanceof 字符) {
        const ch = 元素 as 字符;
        if (!显示康熙部首 && ch.区块() === "kangxi") return false;
        if (!显示部首补充 && ch.区块() === "radicals-sup") return false;
        if (隐藏旧版私用区 && ch.是私用区()) return false;
        const data = 字库.查询字符(ch);
        if (!data) return false;
        const 字形列表 = 字库.查询字符的字形(ch) ?? [];
        for (const 字形 of 字形列表) {
          // 不允许单笔字根
          if (字形.标准笔顺.length === 1) return false;
        }
        return (
          笔顺过滤.过滤字符(ch, data, 字库) || 直接过滤.过滤字符(ch, data, 字库)
        );
      } else if (元素 instanceof 部件 || 元素 instanceof 复合体) {
        if (元素.标准笔顺.length === 1) return false; // 不允许单笔字根
        if (隐藏可被字符唯一对应的字形) {
          const characters = 字形字符映射.get(元素.id) ?? new Set();
          const 可被字符唯一对应 = [...characters]
            .filter((x) => !x.是私用区())
            .some((x) => 字库.查询字符的字形(x)?.length === 1);
          if (可被字符唯一对应) return false;
        }
        return 笔顺过滤.过滤字形(元素, 字库) || 直接过滤.过滤字形(元素, 字库);
      } else {
        return false; // 不应该出现其他类型的元素
      }
    });
  }
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
            &nbsp; 隐藏旧版私用区：
            <Checkbox
              checked={隐藏旧版私用区}
              onChange={(e) => 设置隐藏旧版私用区(e.target.checked)}
            />
          </Flex>
          <Flex>
            隐藏可被字符唯一对应的字形：
            <Checkbox
              checked={隐藏可被字符唯一对应的字形}
              onChange={(e) => 设置隐藏可被字符唯一对应的字形(e.target.checked)}
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
