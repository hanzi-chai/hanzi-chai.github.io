import {
  Button,
  Checkbox,
  Dropdown,
  Form,
  Input,
  Popconfirm,
  Popover,
  Space,
} from "antd";
import {
  ForwardedRef,
  createContext,
  forwardRef,
  useContext,
  useState,
} from "react";
import {
  remoteCreate,
  remoteCreateWithoutUnicode,
  remoteUpdate,
  remoteRemove,
  remoteMutate,
} from "~/lib/api";
import {
  DeleteButton,
  Select,
  errorFeedback,
  verifyNewName,
} from "~/components/Utils";
import {
  deepcopy,
  length,
  isValidCJKChar,
  getDummyBasicComponent,
  getDummyCompound,
  getDummyDerivedComponent,
} from "~/lib/utils";
import {
  useAtomValue,
  useSetAtom,
  mutateRepertoireAtom,
  useAtom,
  repertoireAtom,
  nextUnicodeAtom,
  useAddAtom,
  useRemoveAtom,
  userRepertoireAtom,
  primitiveRepertoireAtom,
  customGlyphAtom,
} from "~/atoms";
import { PrimitveCharacter, Compound, Component } from "~/lib/data";
import ComponentForm from "./ComponentForm";
import CompoundForm from "./CompoundForm";
import { MenuProps } from "antd/lib";
import * as O from "optics-ts/standalone";

interface CreateProps {
  charOrName: string;
  type: "component" | "compound";
}

export const RemoteContext = createContext(true);

export const Create = forwardRef(
  (
    { onCreate }: { onCreate: (s: string) => void },
    ref: ForwardedRef<HTMLElement>,
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
    const base = {
      tygf: 0 as 0,
      gb2312: false,
      gf0014_id: null,
      readings: [],
      glyphs: [
        type === "component"
          ? getDummyDerivedComponent()
          : getDummyCompound("⿰"),
      ],
      ambiguous: false,
    };
    if (length(charOrName) > 1) {
      const raw: Omit<PrimitveCharacter, "unicode"> = {
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
        const value: PrimitveCharacter = { unicode, ...raw };
        char = String.fromCodePoint(unicode);
        add(char, value);
      } else {
        const value: PrimitveCharacter = { unicode: nextUnicode, ...raw };
        char = String.fromCodePoint(nextUnicode);
        addUser(char, value);
      }
      return char;
    } else {
      const character: PrimitveCharacter = {
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
        if (!valid || newName.length > 1) return;
        const newUnicode = newName.codePointAt(0)!;
        const payload = { old: unicode, new: newUnicode };
        console.log(payload);
        const res = await remoteMutate(payload);
        if (!errorFeedback(res)) {
          mutate([unicode, newUnicode]);
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

export const Delete = ({ unicode }: { unicode: number }) => {
  const remote = useContext(RemoteContext);
  const userRepertoire = useAtomValue(userRepertoireAtom);
  const customization = useAtomValue(customGlyphAtom);
  const remove = useRemoveAtom(primitiveRepertoireAtom);
  const removeUser = useRemoveAtom(userRepertoireAtom);
  const removeCustom = useRemoveAtom(customGlyphAtom);
  const char = String.fromCodePoint(unicode);
  return (
    <DeleteButton
      disabled={
        !remote &&
        userRepertoire[char] === undefined &&
        customization[char] === undefined
      }
      onClick={async () => {
        if (remote) {
          const res = await remoteRemove(unicode);
          if (!errorFeedback(res)) {
            remove(char);
          }
        } else {
          removeUser(char);
          removeCustom(char);
        }
      }}
    />
  );
};

export const Add = ({ character }: { character: PrimitveCharacter }) => {
  const remote = useContext(RemoteContext);
  const repertoire = useAtomValue(primitiveRepertoireAtom);
  const add = useAddAtom(primitiveRepertoireAtom);
  const userRepertoire = useAtomValue(userRepertoireAtom);
  const addUser = useAddAtom(userRepertoireAtom);
  const customGlyph = useAtomValue(customGlyphAtom);
  const addCustomization = useAddAtom(customGlyphAtom);
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
  let items: MenuProps["items"] = [
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
          title="添加自定义复合体"
          initialValues={getDummyCompound("⿰")}
          onFinish={onFinish}
          noButton
        />
      ),
    },
  ];
  if (isCustomization) {
    items.unshift(
      ...character.glyphs.map((x, index) => ({
        key: index,
        label: `选择第 ${index + 1} 个系统字形`,
        onClick: () => {
          addCustomization(name, x);
        },
      })),
    );
  }
  return (
    <Dropdown
      menu={{
        items,
      }}
    >
      <Button>{isCustomization ? "自定义" : "添加"}</Button>
    </Dropdown>
  );
};

export const QuickPatchAmbiguous = ({
  checked,
  record,
}: {
  checked: boolean;
  record: PrimitveCharacter;
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
