import {
  Button,
  Checkbox,
  Dropdown,
  Form,
  Input,
  Popconfirm,
  Popover,
} from "antd";
import type { ForwardedRef } from "react";
import { forwardRef, useContext, useState } from "react";
import {
  remoteCreate,
  remoteCreateWithoutUnicode,
  remoteUpdate,
  remoteRemove,
  remoteMutate,
} from "~/api";
import { DeleteButton, NumberInput, Select } from "~/components/Utils";
import type { Reading } from "~/lib";
import {
  chars,
  isValidCJKChar,
  getDummyCompound,
  getDummyDerivedComponent,
  getDummyBasicComponent,
  getDummySplicedComponent,
} from "~/lib";
import {
  useAtomValue,
  useSetAtom,
  mutateRepertoireAtom,
  repertoireAtom,
  nextUnicodeAtom,
  useAddAtom,
  useRemoveAtom,
  userRepertoireAtom,
  primitiveRepertoireAtom,
  customGlyphAtom,
  errorFeedback,
  verifyNewName,
  RemoteContext,
  customReadingsAtom,
} from "~/atoms";
import type { PrimitiveCharacter, Compound, Component } from "~/lib";
import ComponentForm from "./ComponentForm";
import CompoundForm from "./CompoundForm";
import type { MenuProps } from "antd/lib";
import * as O from "optics-ts/standalone";
import ReadingForm from "./ReadingForm";
import { isInteger } from "lodash-es";

interface CreateProps {
  charOrName: string;
  type: "component" | "compound";
}

export const Create = forwardRef(
  (
    { onCreate }: { onCreate: (s: string) => void },
    ref: ForwardedRef<HTMLAnchorElement>,
  ) => (
    <Popover content={<CreatePopoverContent onCreate={onCreate} />}>
      <Button type="primary" ref={ref}>
        新建
      </Button>
    </Popover>
  ),
);

function CreatePopoverContent({ onCreate }: { onCreate: (s: string) => void }) {
  const addUser = useAddAtom(userRepertoireAtom);
  const add = useAddAtom(primitiveRepertoireAtom);
  const remote = useContext(RemoteContext);
  const nextUnicode = useAtomValue(nextUnicodeAtom);
  const determinedRepertoire = useAtomValue(repertoireAtom);
  const options = [
    { label: "部件", value: "component" },
    { label: "复合体", value: "compound" },
  ];
  const handle = async ({ charOrName, type }: CreateProps) => {
    const base: Omit<PrimitiveCharacter, "unicode" | "name"> = {
      tygf: 0 as 0,
      gb2312: 0 as 0,
      gf0014_id: null,
      gf3001_id: null,
      readings: [],
      glyphs: [
        type === "component"
          ? getDummyDerivedComponent()
          : getDummyCompound("⿰"),
      ],
      ambiguous: false,
    };
    if (chars(charOrName) > 1) {
      const raw: Omit<PrimitiveCharacter, "unicode"> = {
        ...base,
        name: charOrName,
      };
      let char;
      if (remote) {
        const unicode = await remoteCreateWithoutUnicode({
          type,
          name: charOrName,
        });
        if (errorFeedback(unicode)) return;
        const value: PrimitiveCharacter = { unicode, ...raw };
        char = String.fromCodePoint(unicode);
        add(char, value);
      } else {
        const value: PrimitiveCharacter = { unicode: nextUnicode, ...raw };
        char = String.fromCodePoint(nextUnicode);
        addUser(char, value);
      }
      return char;
    } else {
      const character: PrimitiveCharacter = {
        unicode: charOrName.codePointAt(0)!,
        name: null,
        ...base,
      };
      if (remote) {
        const res = await remoteCreate(character);
        if (errorFeedback(res)) return;
        add(charOrName, character);
      } else {
        addUser(charOrName, character);
      }
      return charOrName;
    }
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
            validator: (_, value) => {
              if (!value) return Promise.reject(new Error("不能为空"));
              if (determinedRepertoire[value as string] !== undefined)
                return Promise.reject(new Error("字符已存在"));
              const valid = Array.from(value as string).every(isValidCJKChar);
              if (!valid) return Promise.reject(new Error("限 CJK/扩展 A"));
              return Promise.resolve();
            },
          },
        ]}
      >
        <Input style={{ width: 128 }} />
      </Form.Item>
      <Form.Item<CreateProps>
        label="类型"
        name="type"
        rules={[{ required: true }]}
      >
        <Select options={options} style={{ width: 128 }} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          确认
        </Button>
      </Form.Item>
    </Form>
  );
}

export const Mutate = ({ unicode }: { unicode: number }) => {
  const [newName, setNewName] = useState("");
  const remote = useContext(RemoteContext);
  const mutate = useSetAtom(mutateRepertoireAtom);
  const repertoire = useAtomValue(primitiveRepertoireAtom);
  const update = useAddAtom(primitiveRepertoireAtom);
  const name = String.fromCodePoint(unicode);
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
        const valid = verifyNewName(newName);
        if (!valid) return;
        if (Array.from(newName).length === 1) {
          // 改变 Unicode，需要联动更新
          const newUnicode = newName.codePointAt(0)!;
          const payload = { old: unicode, new: newUnicode };
          const res = await remoteMutate(payload);
          if (!errorFeedback(res)) {
            mutate([unicode, newUnicode]);
          }
        } else {
          // 改变别名，不需要联动更新
          const character = repertoire[name];
          if (!character) return;
          const newCharacter: PrimitiveCharacter = {
            ...character,
            name: newName,
          };
          const res = await remoteUpdate(newCharacter);
          if (!errorFeedback(res)) {
            update(name, newCharacter);
          }
        }
      }}
    >
      <Button
        disabled={isValidCJKChar(String.fromCodePoint(unicode))}
        style={{ display: remote ? "initial" : "none" }}
      >
        更改
      </Button>
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
  const remote = useContext(RemoteContext);
  const repertoire = useAtomValue(primitiveRepertoireAtom);
  const update = useAddAtom(primitiveRepertoireAtom);
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
        const character = repertoire[name];
        if (!character) return;
        const newCharacter: PrimitiveCharacter = {
          ...character,
          [type]: id === 0 ? null : id,
        };
        const res = await remoteUpdate(newCharacter);
        if (!errorFeedback(res)) {
          update(name, newCharacter);
        }
      }}
    >
      <Button style={{ display: remote ? "initial" : "none" }}>
        {value ?? "无"}
      </Button>
    </Popconfirm>
  );
};

export const Delete = ({ unicode }: { unicode: number }) => {
  const remote = useContext(RemoteContext);
  const userRepertoire = useAtomValue(userRepertoireAtom);
  const remove = useRemoveAtom(primitiveRepertoireAtom);
  const removeUser = useRemoveAtom(userRepertoireAtom);
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

export const EditGlyph = ({ character }: { character: PrimitiveCharacter }) => {
  const remote = useContext(RemoteContext);
  const repertoire = useAtomValue(primitiveRepertoireAtom);
  const add = useAddAtom(primitiveRepertoireAtom);
  const addUser = useAddAtom(userRepertoireAtom);
  const customGlyph = useAtomValue(customGlyphAtom);
  const addCustomization = useAddAtom(customGlyphAtom);
  const removeCustomization = useRemoveAtom(customGlyphAtom);
  const name = String.fromCodePoint(character.unicode);
  const isCustomization = !remote && repertoire[name] !== undefined;
  const onFinish = async (component: Component | Compound) => {
    if (isCustomization) {
      addCustomization(name, component);
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
    } else {
      addUser(name, newCharacter);
      return true;
    }
  };
  const items: MenuProps["items"] = [
    {
      key: -1,
      label: (
        <ComponentForm
          title="添加自定义衍生部件"
          initialValues={getDummyDerivedComponent()}
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
          initialValues={getDummySplicedComponent()}
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
          initialValues={getDummyCompound("⿰")}
          onFinish={onFinish}
          noButton
        />
      ),
    },
  ];
  if (remote) {
    items.unshift({
      key: -4,
      label: (
        <ComponentForm
          title="添加自定义基本部件"
          initialValues={getDummyBasicComponent()}
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
        label: `选择第 ${index + 1} 个系统字形`,
        onClick: () => addCustomization(name, x),
      })),
    );
    if (customGlyph[name] !== undefined) {
      items.push({
        key: -5,
        label: <span>取消自定义字形</span>,
        onClick: () => removeCustomization(name),
      });
    }
  }
  return (
    <Dropdown menu={{ items }}>
      <Button>{(isCustomization ? "自定义" : "编辑") + "字形"}</Button>
    </Dropdown>
  );
};

export const EditReading = ({
  character,
}: {
  character: PrimitiveCharacter;
}) => {
  const remote = useContext(RemoteContext);
  const add = useAddAtom(primitiveRepertoireAtom);
  const addUser = useAddAtom(userRepertoireAtom);
  const repertoire = useAtomValue(primitiveRepertoireAtom);
  const customReadings = useAtomValue(customReadingsAtom);
  const addCustomReading = useAddAtom(customReadingsAtom);
  const removeCustomReading = useRemoveAtom(customReadingsAtom);
  const name = String.fromCodePoint(character.unicode);
  const readings = customReadings[name] ?? character.readings;
  const isCustomization = !remote && repertoire[name] !== undefined;
  const onFinish = async ({ readings }: { readings: Reading[] }) => {
    if (isCustomization) {
      addCustomReading(name, readings);
      return true;
    }
    const newCharacter = { ...character, readings };
    if (remote) {
      const res = await remoteUpdate(newCharacter);
      if (!errorFeedback(res)) {
        add(name, newCharacter);
        return true;
      }
      return false;
    } else {
      addUser(name, newCharacter);
      return true;
    }
  };
  const items: MenuProps["items"] = [
    {
      key: -1,
      label: (
        <ReadingForm
          title="编辑字音"
          initialValues={readings}
          onFinish={onFinish}
        />
      ),
    },
  ];
  if (isCustomization && customReadings[name] !== undefined) {
    items.push({
      key: -2,
      label: <span>取消自定义字音</span>,
      onClick: () => removeCustomReading(name),
    });
  }
  return (
    <Dropdown menu={{ items }}>
      <Button>{(isCustomization ? "自定义" : "编辑") + "字音"}</Button>
    </Dropdown>
  );
};

export const QuickPatchAmbiguous = ({
  checked,
  record,
}: {
  checked: boolean;
  record: PrimitiveCharacter;
}) => {
  const remote = useContext(RemoteContext);
  const add = useAddAtom(primitiveRepertoireAtom);
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
