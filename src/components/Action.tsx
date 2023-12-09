import { Button, Checkbox, Form, Input, Popconfirm, Popover } from "antd";
import { createContext, useContext, useState } from "react";
import {
  remoteCreate,
  remoteCreateWithoutUnicode,
  remoteUpdate,
  remoteRemove,
  remoteMutate,
} from "~/lib/api";
import type { Glyph, GlyphOptionalUnicode } from "~/lib/data";
import type { IndexEdit2 } from "~/components/Utils";
import { Select, errorFeedback, verifyNewName } from "~/components/Utils";
import { deepcopy, length, isValidCJKChar, formDefault } from "~/lib/utils";
import {
  mutate,
  remove,
  selectForm,
  update,
  useAppDispatch,
  useAppSelector,
} from "~/components/store";
import { ModelContext } from "~/components/GlyphModel";
import { useAdd, useData, useRemove } from "./context";
import { useCode, useForm } from "./contants";

export const getValue = function (
  newName: string,
  char: string,
  glyph: Glyph,
): GlyphOptionalUnicode {
  const unicode = length(newName) === 1 ? newName.codePointAt(0)! : undefined;
  const value: GlyphOptionalUnicode = deepcopy(glyph);
  value.unicode = unicode;
  value.name = length(newName) === 1 ? null : newName;
  value.gf0014_id = null;
  return value;
};

interface CreateProps {
  charOrName: string;
  default_type: "component" | "compound";
}

export const RemoteContext = createContext(true);

export const Create = ({ setChar }: Omit<IndexEdit2, "char">) => (
  <Popover content={<CreatePopoverContent setChar={setChar} />}>
    <Button type="primary">新建</Button>
  </Popover>
);

function CreatePopoverContent(props: any) {
  const dispatch = useAppDispatch();
  const add = useAdd();
  const remote = useContext(RemoteContext);
  const code = useCode();
  const form = useForm();
  const options = [
    { label: "部件", value: "component" },
    { label: "复合体", value: "compound" },
  ];
  const handle = async ({ charOrName, default_type }: CreateProps) => {
    const initial = {
      default_type,
      [default_type]: formDefault[default_type],
      gf0014_id: null,
      ambiguous: false,
    };
    if (length(charOrName) > 1) {
      const payload: GlyphOptionalUnicode = {
        ...initial,
        name: charOrName,
      };
      let char;
      if (remote) {
        const res = await remoteCreateWithoutUnicode(payload);
        if (errorFeedback(res)) return;
        const value = { ...payload, unicode: res } as Glyph;
        char = String.fromCodePoint(res);
        dispatch(update(value));
      } else {
        const value = { ...payload, unicode: code } as Glyph;
        char = String.fromCodePoint(code);
        add(char, value);
      }
      return char;
    } else {
      const unicode = charOrName.codePointAt(0)!;
      const payload: Glyph = {
        ...initial,
        unicode,
        name: null,
      } as Glyph;
      if (remote) {
        const res = await remoteCreate(payload);
        if (errorFeedback(res)) return;
        dispatch(update(payload));
      } else {
        add(charOrName, payload);
      }
      return charOrName;
    }
  };
  return (
    <Form<CreateProps>
      onFinish={async (values) => {
        const char = await handle(values);
        if (char !== undefined) props.setChar(char);
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
        name="default_type"
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
  const dispatch = useAppDispatch();
  const [newName, setNewName] = useState("");
  const remote = useContext(RemoteContext);
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
        const res = await remoteMutate([unicode, newUnicode]);
        if (!errorFeedback(res)) {
          dispatch(mutate([unicode, newUnicode]));
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

export const Update = ({ setChar }: Omit<IndexEdit2, "char">) => {
  const dispatch = useAppDispatch();
  const model = useContext(ModelContext);
  const remote = useContext(RemoteContext);
  const add = useAdd();
  return (
    <Button
      type="primary"
      onClick={async () => {
        const values = model.getFieldsValue();
        if (remote) {
          // 管理模式
          const res = await remoteUpdate(values);
          if (!errorFeedback(res)) {
            dispatch(update(values));
            setChar(undefined);
          }
        } else {
          // 用户模式
          add(String.fromCodePoint(values.unicode), values);
          setChar(undefined);
        }
      }}
    >
      更新
    </Button>
  );
};

export const Delete = ({ unicode }: { unicode: number }) => {
  const dispatch = useAppDispatch();
  const remote = useContext(RemoteContext);
  const formCustomization = useData().form;
  const form = useAppSelector(selectForm);
  const del = useRemove();
  const char = String.fromCodePoint(unicode);
  return (
    <Button
      disabled={!remote && formCustomization[char] === undefined}
      onClick={async () => {
        if (remote) {
          const res = await remoteRemove(unicode);
          if (!errorFeedback(res)) {
            dispatch(remove(unicode));
          }
        } else {
          del(String.fromCodePoint(unicode));
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
  record: Glyph;
}) => {
  const dispatch = useAppDispatch();
  const remote = useContext(RemoteContext);
  return (
    <Checkbox
      checked={checked}
      disabled={!remote}
      onChange={async (event) => {
        const checked = event.target.checked;
        const values = { ...record, ambiguous: checked };
        const res = await remoteUpdate(values);
        if (!errorFeedback(res)) {
          dispatch(update(values));
        }
      }}
    />
  );
};
