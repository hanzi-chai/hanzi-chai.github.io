import { Button, Checkbox, Form, Input, Popconfirm, Popover } from "antd";
import { createContext, useContext, useState } from "react";
import {
  remoteCreate,
  remoteCreateWithoutUnicode,
  remoteUpdate,
  remoteRemove,
  remoteMutate,
} from "~/lib/api";
import { Select, errorFeedback, verifyNewName } from "~/components/Utils";
import { deepcopy, length, isValidCJKChar } from "~/lib/utils";
import { ModelContext } from "~/components/CharacterModel";
import {
  useAtomValue,
  useSetAtom,
  mutateFormAtom,
  useAtom,
  determinedRepertoireAtom,
  nextUnicodeAtom,
  useAddAtom,
  useRemoveAtom,
  userRepertoireAtom,
  repertoireAtom,
} from "~/atoms";
import { Character } from "~/lib/data";

interface CreateProps {
  charOrName: string;
  type: "component" | "compound";
}

export const RemoteContext = createContext(true);

export const Create = ({ onCreate }: { onCreate: (s: string) => void }) => (
  <Popover content={<CreatePopoverContent onCreate={onCreate} />}>
    <Button type="primary">新建</Button>
  </Popover>
);

function CreatePopoverContent({ onCreate }: { onCreate: (s: string) => void }) {
  const addUser = useAddAtom(userRepertoireAtom);
  const add = useAddAtom(repertoireAtom);
  const remote = useContext(RemoteContext);
  const nextUnicode = useAtomValue(nextUnicodeAtom);
  const form = useAtomValue(determinedRepertoireAtom);
  const options = [
    { label: "部件", value: "component" },
    { label: "复合体", value: "compound" },
  ];
  const handle = async ({ charOrName, type }: CreateProps) => {
    if (length(charOrName) > 1) {
      const raw: Omit<Character, "unicode"> = {
        tygf: 0,
        gb2312: false,
        name: charOrName,
        gf0014_id: null,
        readings: [],
        glyphs: [],
        ambiguous: false,
      };
      let char;
      if (remote) {
        const unicode = await remoteCreateWithoutUnicode({
          type,
          name: charOrName,
        });
        if (errorFeedback(unicode)) return;
        const value: Character = { unicode, ...raw };
        char = String.fromCodePoint(unicode);
        add(char, value);
      } else {
        const value: Character = { unicode: nextUnicode, ...raw };
        char = String.fromCodePoint(nextUnicode);
        addUser(char, value);
      }
      return char;
    } else {
      const character: Character = {
        unicode: charOrName.codePointAt(0)!,
        tygf: 0,
        gb2312: false,
        name: null,
        gf0014_id: null,
        readings: [],
        glyphs: [],
        ambiguous: false,
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
        label="名称"
        name="charOrName"
        rules={[
          {
            required: true,
            validator: (_, value) => {
              if (!value) return Promise.reject(new Error("不能为空"));
              if (form[value as string] !== undefined)
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
  const mutateForm = useSetAtom(mutateFormAtom);
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
        const res = await remoteMutate({ old: unicode, new: newUnicode });
        if (!errorFeedback(res)) {
          mutateForm([unicode, newUnicode]);
        }
      }}
    >
      <Button
        disabled={isValidCJKChar(String.fromCodePoint(unicode))}
        style={{ display: remote ? "initial" : "none" }}
      >
        替换为成字
      </Button>
    </Popconfirm>
  );
};

export const Delete = ({ unicode }: { unicode: number }) => {
  const remote = useContext(RemoteContext);
  const form = useAtomValue(repertoireAtom);
  const formCustomization = useAtomValue(userRepertoireAtom);
  const remove = useRemoveAtom(repertoireAtom);
  const removeUser = useRemoveAtom(userRepertoireAtom);
  const char = String.fromCodePoint(unicode);
  return (
    <Button
      disabled={!remote && formCustomization[char] === undefined}
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
    >
      {remote || !form[char] ? "删除" : "重置"}
    </Button>
  );
};

export const QuickPatchAmbiguous = ({
  checked,
  record,
}: {
  checked: boolean;
  record: Character;
}) => {
  const remote = useContext(RemoteContext);
  const add = useAddAtom(repertoireAtom);
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
