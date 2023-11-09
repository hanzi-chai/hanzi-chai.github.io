import { Button, Checkbox, Form, Input, Popconfirm, Popover } from "antd";
import { createContext, useContext, useEffect, useState } from "react";
import {
  Err,
  remoteCreate,
  remoteCreateWithoutUnicode,
  remoteUpdate,
  remoteRemove,
  remoteMutate,
} from "~/lib/api";
import { Glyph, GlyphOptionalUnicode } from "~/lib/data";
import {
  Index,
  IndexEdit2,
  Select,
  errorFeedback,
  verifyNewName,
} from "~/components/Utils";
import { deepcopy, length, isValidCJKChar, formDefault } from "~/lib/utils";
import { mutate, remove, update, useAppDispatch } from "~/components/store";
import { GlyphModel, ModelContext } from "~/components/GlyphModel";

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
  default_type: "component" | "slice" | "compound";
}

export const RemoteContext = createContext(true);

export const Create = ({ setChar }: Omit<IndexEdit2, "char">) => {
  const dispatch = useAppDispatch();

  const options = [
    { label: "部件", value: "component" },
    { label: "切片", value: "slice" },
    { label: "复合体", value: "compound" },
  ];
  const typemap: Record<keyof typeof formDefault, 0 | 1 | 2> = {
    component: 0,
    slice: 1,
    compound: 2,
  };

  return (
    <Popover
      content={
        <Form<CreateProps>
          onFinish={async ({ charOrName, default_type }) => {
            const valid = verifyNewName(charOrName);
            if (!valid) return;
            const initial = {
              default_type: typemap[default_type],
              [default_type]: formDefault[default_type],
              gf0014_id: null,
              ambiguous: false,
            };
            if (length(charOrName) > 1) {
              const payload: GlyphOptionalUnicode = {
                ...initial,
                name: charOrName,
              };
              const res = await remoteCreateWithoutUnicode(payload);
              if (!errorFeedback(res)) {
                const value = { ...payload, unicode: res } as Glyph;
                const char = String.fromCodePoint(res);
                dispatch(update(value));
                setChar(char);
              }
            } else {
              const unicode = charOrName.codePointAt(0)!;
              const payload: Glyph = {
                ...initial,
                unicode,
                name: null,
              } as Glyph;
              const res = await remoteCreate(payload);
              if (!errorFeedback(res)) {
                dispatch(update(payload));
                setChar(charOrName);
              }
            }
          }}
        >
          <Form.Item<CreateProps> label="名称" name="charOrName">
            <Input />
          </Form.Item>
          <Form.Item<CreateProps> label="类型" name="default_type">
            <Select options={options} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              确认
            </Button>
          </Form.Item>
        </Form>
      }
    >
      <Button>新建</Button>
    </Popover>
  );
};

export const Mutate = ({ char }: Index) => {
  const dispatch = useAppDispatch();
  const [newName, setNewName] = useState("");
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
        const res = await remoteMutate([
          char.codePointAt(0)!,
          newName.codePointAt(0)!,
        ]);
        if (!errorFeedback(res)) {
          dispatch(mutate([char, newName]));
        }
      }}
    >
      <Button disabled={isValidCJKChar(char)}>替换为成字</Button>
    </Popconfirm>
  );
};

export const Update = () => {
  const dispatch = useAppDispatch();
  const model = useContext(ModelContext);
  return (
    <Button
      type="primary"
      onClick={async () => {
        const values = model.getFieldsValue();
        const res = await remoteUpdate(values);
        if (!errorFeedback(res)) {
          dispatch(update(values));
        }
      }}
    >
      更新
    </Button>
  );
};

export const Delete = ({ char }: Index) => {
  const dispatch = useAppDispatch();
  return (
    <Button
      onClick={async () => {
        const res = await remoteRemove(char.codePointAt(0)!);
        if (!errorFeedback(res)) {
          dispatch(remove(char!));
        }
      }}
    >
      删除
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
