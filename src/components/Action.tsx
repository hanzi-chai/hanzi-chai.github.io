import { Button, Input, Popconfirm } from "antd";
import { createContext, useContext, useEffect, useState } from "react";
import { Err, delet, get, patch, post, put } from "~/lib/api";
import { Glyph, GlyphOptionalUnicode } from "~/lib/data";
import {
  EditorColumn,
  EditorRow,
  Index,
  IndexEdit2,
  errorFeedback,
  verifyNewName,
} from "~/components/Utils";
import { deepcopy, length, preprocessForm, validChar } from "~/lib/utils";
import {
  loadForm,
  mutate,
  remove,
  selectForm,
  selectFormLoading,
  update,
  useAppDispatch,
  useAppSelector,
} from "~/components/store";
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

export const Create = ({ char, setChar }: IndexEdit2) => {
  const formData = useAppSelector(selectForm);
  const form = useContext(ModelContext);
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
        if (!valid) return;
        const value = getValue(newName, char, formData[char]);
        console.log(value);
        const slug =
          value.unicode === undefined ? "form" : `form/${value.unicode}`;
        const res = await post<number, any>(slug, value);
        if (!errorFeedback(res)) {
          const newChar = String.fromCodePoint(res);
          const finish = { ...value, unicode: res } as Glyph;
          console.log(res, String.fromCodePoint(res), finish);
          dispatch(update([newChar, finish]));
          setChar(newChar);
          form.setFieldsValue(finish);
        }
      }}
    >
      <Button>新建</Button>
    </Popconfirm>
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
        const res = await patch<boolean, number>(
          `form/${char.codePointAt(0)!}`,
          newName.codePointAt(0)!,
        );
        console.log(char, char.codePointAt(0), newName, newName.codePointAt(0));
        if (!errorFeedback(res)) {
          dispatch(mutate([char, newName]));
        }
      }}
    >
      <Button disabled={validChar(char)}>替换为成字</Button>
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
        console.log(values);
        const res = await put<boolean, typeof values>(
          `form/${values.unicode}`,
          values,
        );
        if (!errorFeedback(res)) {
          const char = String.fromCodePoint(values.unicode);
          dispatch(update([char!, values]));
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
        const res = await delet<boolean, undefined>(
          `form/${char!.codePointAt(0)}`,
        );
        if (!errorFeedback(res)) {
          dispatch(remove(char!));
        }
      }}
    >
      删除
    </Button>
  );
};
