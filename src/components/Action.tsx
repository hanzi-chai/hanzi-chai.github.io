import {
  Button,
  Checkbox,
  Dropdown,
  Form,
  Input,
  Popconfirm,
  Popover,
  Select,
} from "antd";
import type { MenuProps } from "antd/lib";
import { isInteger } from "lodash-es";
import * as O from "optics-ts/standalone";
import type { ForwardedRef } from "react";
import { forwardRef, useState } from "react";
import {
  remoteBatchUpdate,
  remoteCreate,
  remoteCreateWithoutUnicode,
  remoteRemove,
  remoteUpdate,
} from "~/api";
import {
  useAddAtom,
  useAtom,
  useAtomValue,
  useRemoveAtom,
  下一个可用的码位原子,
  原始可编辑字库数据原子,
  原始字库原子,
  字形自定义原子,
  标准字形自定义原子,
  用户原始字库数据原子,
  远程原子,
} from "~/atoms";
import { DeleteButton, NumberInput } from "~/components/Utils";
import {
  字数 as chars,
  创建原始汉字数据,
  type 原始字库数据,
  type 原始汉字数据,
  type 字形数据,
  模拟全等,
  模拟基本部件,
  模拟复合体,
  模拟拼接部件,
  模拟衍生部件,
} from "~/lib";
import { errorFeedback } from "~/utils";
import CharacterSelect from "./CharacterSelect";
import ComponentForm, { IdentityForm } from "./ComponentForm";
import CompoundForm from "./CompoundForm";

interface CreateProps {
  charOrName: string;
  type: 字形数据["type"];
}

export const Create = forwardRef(
  (
    { onCreate }: { onCreate: (s: string) => void },
    ref: ForwardedRef<HTMLAnchorElement>,
  ) => (
    <Popover content={<CreatePopoverContent onCreate={onCreate} />}>
      <Button type="primary" ref={ref}>
        新建字符
      </Button>
    </Popover>
  ),
);

function CreatePopoverContent({ onCreate }: { onCreate: (s: string) => void }) {
  const addUser = useAddAtom(用户原始字库数据原子);
  const add = useAddAtom(原始可编辑字库数据原子);
  const remote = useAtomValue(远程原子);
  const nextUnicode = useAtomValue(下一个可用的码位原子);
  const 原始字库 = useAtomValue(原始字库原子);
  const options = [
    { label: "衍生部件", value: "derived_component" },
    { label: "拼接部件", value: "spliced_component" },
    { label: "复合体", value: "compound" },
    { label: "全等字形", value: "identity" },
  ];
  const handle = async ({ charOrName, type }: CreateProps) => {
    const glyph =
      type === "derived_component"
        ? 模拟衍生部件()
        : type === "spliced_component"
          ? 模拟拼接部件()
          : type === "identity"
            ? 模拟全等()
            : 模拟复合体("⿰");
    if (chars(charOrName) > 1) {
      let char: string;
      if (remote) {
        const unicode = await remoteCreateWithoutUnicode({
          type,
          name: charOrName,
        });
        if (errorFeedback(unicode)) return;
        const value: 原始汉字数据 = 创建原始汉字数据(
          unicode,
          [glyph],
          charOrName,
        );
        char = String.fromCodePoint(unicode);
        add(char, value);
      } else {
        const value: 原始汉字数据 = 创建原始汉字数据(
          nextUnicode,
          [glyph],
          charOrName,
        );
        char = String.fromCodePoint(nextUnicode);
        addUser(char, value);
      }
      return char;
    }
    const unicode = charOrName.codePointAt(0)!;
    const character: 原始汉字数据 = 创建原始汉字数据(unicode, [glyph]);
    if (remote) {
      const res = await remoteCreate(character);
      if (errorFeedback(res)) return;
      add(charOrName, character);
    } else {
      addUser(charOrName, character);
    }
    return charOrName;
  };
  return (
    <Form<CreateProps>
      onFinish={async (values) => {
        const char = await handle(values);
        if (char !== undefined) onCreate(char);
      }}
    >
      <Form.Item<CreateProps>
        label="字或别名"
        name="charOrName"
        rules={[
          {
            required: true,
            validator: (_, value: string) => {
              if (!value) return Promise.reject(new Error("不能为空"));
              if (原始字库.查询(value) !== undefined)
                return Promise.reject(new Error("字符已存在"));
              return Promise.resolve();
            },
          },
        ]}
      >
        <Input width={128} />
      </Form.Item>
      <Form.Item<CreateProps>
        label="类型"
        name="type"
        rules={[{ required: true }]}
      >
        <Select options={options} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          确认
        </Button>
      </Form.Item>
    </Form>
  );
}

const planMerge = (
  oldUnicode: number,
  newUnicode: number,
  repertoire: 原始字库数据,
) => {
  const before = String.fromCodePoint(oldUnicode);
  const after = String.fromCodePoint(newUnicode);
  const replaceIf = (s: string, o: { changed: boolean }) => {
    if (s === before) {
      o.changed = true;
      return after;
    }
    return s;
  };
  const payload: 原始字库数据 = {};
  for (const [key, value] of Object.entries(repertoire)) {
    const o = { changed: false };
    const newValue = structuredClone(value);
    newValue.glyphs.forEach((x) => {
      if (x.type === "derived_component" || x.type === "identity") {
        x.source = replaceIf(x.source, o);
      } else if (x.type === "compound" || x.type === "spliced_component") {
        x.operandList = x.operandList.map((v) => replaceIf(v, o));
      }
    });
    if (o.changed) {
      payload[key] = newValue;
    }
  }
  return payload;
};

export const Merge = ({ unicode }: { unicode: number }) => {
  const [newName, setNewName] = useState("");
  const [repertoire, setRepertoire] = useAtom(原始可编辑字库数据原子);
  return (
    <Popconfirm
      title="输入笔画搜索"
      description={<CharacterSelect value={newName} onChange={setNewName} />}
      onConfirm={async () => {
        // 改变 Unicode，需要联动更新
        const newUnicode = newName.codePointAt(0)!;
        const payload: 原始字库数据 = planMerge(
          unicode,
          newUnicode,
          repertoire,
        );
        const res = await remoteBatchUpdate(Object.values(payload));
        if (!errorFeedback(res)) {
          setRepertoire((prev) => ({ ...prev, ...payload }));
        }
      }}
    >
      <Button>合并到</Button>
    </Popconfirm>
  );
};

export const Rename = ({
  unicode,
  name,
}: {
  unicode: number;
  name: string | null;
}) => {
  const [newName, setNewName] = useState("");
  const 原始字库 = useAtomValue(原始字库原子);
  const update = useAddAtom(原始可编辑字库数据原子);
  return (
    <Popconfirm
      title="新字形名称"
      description={
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
      }
      onConfirm={async () => {
        const cname = String.fromCodePoint(unicode);
        const character = 原始字库.查询(cname);
        if (!character) return;
        const newCharacter: 原始汉字数据 = {
          ...character,
          name: newName,
        };
        const res = await remoteUpdate(newCharacter);
        if (!errorFeedback(res)) {
          update(cname, newCharacter);
        }
      }}
    >
      <Button>{name ?? "无"}</Button>
    </Popconfirm>
  );
};

export const EditGF = ({
  type,
  value,
  unicode,
}: {
  type: "gf3001_id" | "gf0014_id";
  value: number | null;
  unicode: number;
}) => {
  const [id, setId] = useState(0);
  const 原始字库 = useAtomValue(原始字库原子);
  const update = useAddAtom(原始可编辑字库数据原子);
  const name = String.fromCodePoint(unicode);
  return (
    <Popconfirm
      title="新 ID"
      description={
        <NumberInput value={id} onChange={(value) => setId(value as number)} />
      }
      onConfirm={async () => {
        // id = 0 时表示删除
        const valid = isInteger(id) && id >= 0 && id < 561;
        if (!valid) return;
        const character = 原始字库.查询(name);
        if (!character) return;
        const newCharacter: 原始汉字数据 = {
          ...character,
          [type]: id === 0 ? null : id,
        };
        const res = await remoteUpdate(newCharacter);
        if (!errorFeedback(res)) {
          update(name, newCharacter);
        }
      }}
    >
      <Button>{value ?? "无"}</Button>
    </Popconfirm>
  );
};

export const Delete = ({ unicode }: { unicode: number }) => {
  const remote = useAtomValue(远程原子);
  const userRepertoire = useAtomValue(用户原始字库数据原子);
  const remove = useRemoveAtom(原始可编辑字库数据原子);
  const removeUser = useRemoveAtom(用户原始字库数据原子);
  const char = String.fromCodePoint(unicode);
  return (
    <DeleteButton
      disabled={!remote && userRepertoire[char] === undefined}
      onClick={async () => {
        if (remote) {
          const res = await remoteRemove(unicode);
          if (!errorFeedback(res)) {
            remove(char);
          }
        } else {
          removeUser(char);
        }
      }}
    />
  );
};

export const EditGlyph = ({ character }: { character: 原始汉字数据 }) => {
  const remote = useAtomValue(远程原子);
  const 原始字库 = useAtomValue(原始字库原子);
  const add = useAddAtom(原始可编辑字库数据原子);
  const addUser = useAddAtom(用户原始字库数据原子);
  const 标准字形自定义 = useAtomValue(标准字形自定义原子);
  const addCustomization = useAddAtom(字形自定义原子);
  const name = String.fromCodePoint(character.unicode);
  const isCustomization = !remote && 原始字库.查询(name) !== undefined;
  const 自定义列表 = 标准字形自定义[name] ?? [];
  const onFinish = async (component: 字形数据) => {
    if (isCustomization) {
      addCustomization(name, 自定义列表.concat(component));
      return true;
    }
    const newCharacter = O.set(
      O.compose("glyphs", O.appendTo),
      component,
      character,
    );
    if (remote) {
      const res = await remoteUpdate(newCharacter);
      if (!errorFeedback(res)) {
        add(name, newCharacter);
        return true;
      }
      return false;
    }
    addUser(name, newCharacter);
    return true;
  };
  const items: MenuProps["items"] = [
    {
      key: -1,
      label: (
        <ComponentForm
          title="添加自定义衍生部件"
          initialValues={模拟衍生部件()}
          current={name}
          onFinish={onFinish}
          noButton
        />
      ),
    },
    {
      key: -2,
      label: (
        <CompoundForm
          title="添加自定义拼接部件"
          initialValues={模拟拼接部件()}
          onFinish={onFinish}
          noButton
        />
      ),
    },
    {
      key: -3,
      label: (
        <CompoundForm
          title="添加自定义复合体"
          initialValues={模拟复合体("⿰")}
          onFinish={onFinish}
          noButton
        />
      ),
    },
    {
      key: -4,
      label: (
        <IdentityForm
          title="添加自定义全等字形"
          initialValues={模拟全等()}
          current={name}
          onFinish={onFinish}
          noButton
        />
      ),
    },
  ];
  if (remote) {
    items.unshift({
      key: -5,
      label: (
        <ComponentForm
          title="添加自定义基本部件"
          initialValues={模拟基本部件()}
          current={name}
          onFinish={onFinish}
          noButton
        />
      ),
    });
  }
  if (isCustomization) {
    items.unshift(
      ...character.glyphs.map((x, index) => ({
        key: index,
        label: `添加第 ${index + 1} 个系统字形`,
        onClick: () => addCustomization(name, 自定义列表.concat(x)),
      })),
    );
  }
  return (
    <Dropdown menu={{ items }}>
      <Button>{`${isCustomization ? "自定义" : "编辑"}字形`}</Button>
    </Dropdown>
  );
};

export const QuickPatchAmbiguous = ({
  checked,
  record,
}: {
  checked: boolean;
  record: 原始汉字数据;
}) => {
  const remote = useAtomValue(远程原子);
  const add = useAddAtom(原始可编辑字库数据原子);
  return (
    <Checkbox
      checked={checked}
      disabled={!remote}
      onChange={async (event) => {
        const checked = event.target.checked;
        const values = { ...record, ambiguous: checked };
        const res = await remoteUpdate(values);
        if (!errorFeedback(res)) {
          add(String.fromCodePoint(record.unicode), values);
        }
      }}
    />
  );
};
