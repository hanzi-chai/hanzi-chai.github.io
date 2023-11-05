import { Button, Flex, Form } from "antd";
import { useState } from "react";
import { ItemSelect, Select } from "./Utils";
import classifier, { Feature } from "~/lib/classifier";
import { selectForm, useAppSelector } from "./store";
import { displayName } from "~/lib/utils";
import { getSequence } from "~/lib/form";
import Char from "./Char";
import { Glyph } from "~/lib/data";
import { useForm } from "./contants";

interface LookupModel {
  componentHasFeature: Feature;
  compoundHasComponent: string;
}

const Lookup = ({
  char,
  setChar,
}: {
  char: string;
  setChar: (s: string) => void;
}) => {
  const form = useForm();
  const [lookup] = Form.useForm<LookupModel>();
  const [chars, setChars] = useState<{ label: string; value: string }[]>([]);
  const [expand, setExpand] = useState(false);
  return (
    <>
      <Flex gap="middle" justify="center">
        <Form.Item label="笔画搜索">
          <ItemSelect value={char} onChange={setChar} />
        </Form.Item>
        <Button onClick={() => setExpand(!expand)}>
          {expand ? "隐藏" : "显示"}高级搜索选项
        </Button>
        {expand && (
          <Form<LookupModel>
            form={lookup}
            initialValues={{}}
            onFinish={(value) => {
              const { componentHasFeature, compoundHasComponent } = value;
              if (componentHasFeature) {
                const allResults = Object.entries(form)
                  .filter(
                    ([, v]) =>
                      v.component !== undefined &&
                      v.component
                        .map((x) => x.feature)
                        .includes(componentHasFeature),
                  )
                  .map(([x, v]) => ({
                    value: x,
                    label: displayName(x, v),
                  }))
                  .sort((a, b) => {
                    return (
                      getSequence(form, classifier, a.value).length -
                      getSequence(form, classifier, b.value).length
                    );
                  });
                setChars(allResults);
              } else if (compoundHasComponent) {
                const allResults = Object.entries(form)
                  .map(([x, v]) => ({
                    value: x,
                    label: displayName(x, v),
                  }))
                  .filter(({ value }) => {
                    if (value === compoundHasComponent) return true;
                    const glyph = form[value];
                    if (glyph.default_type === 1) {
                      return glyph.slice.source === compoundHasComponent;
                    } else if (glyph.default_type === 2) {
                      return glyph.compound.some((x) =>
                        x.operandList.includes(compoundHasComponent),
                      );
                    }
                    return false;
                  })
                  .sort((a, b) => {
                    return (
                      getSequence(form, classifier, a.value).length -
                      getSequence(form, classifier, b.value).length
                    );
                  });
                setChars(allResults);
              }
            }}
          >
            <Flex
              justify="center"
              align="center"
              style={{ alignSelf: "center" }}
              gap="middle"
            >
              <Form.Item<LookupModel>
                label="部件包含笔画"
                name="componentHasFeature"
              >
                <Select
                  style={{ width: "96px" }}
                  options={Object.keys(classifier)
                    .map((x) => ({
                      label: x,
                      value: x,
                    }))
                    .concat({ label: "无", value: "" })}
                />
              </Form.Item>
              <Form.Item<LookupModel>
                label="复合体包含部件"
                name="compoundHasComponent"
              >
                <ItemSelect />
              </Form.Item>
              <Form.Item>
                <Button
                  onClick={() => {
                    lookup.resetFields();
                    setChars([]);
                  }}
                >
                  清空
                </Button>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  查询
                </Button>
              </Form.Item>
            </Flex>
          </Form>
        )}
      </Flex>
      <Flex wrap="wrap" justify="center">
        {chars.map(({ value, label }, index) => {
          return (
            <Char key={index} onClick={() => setChar(value)}>
              {label}
            </Char>
          );
        })}
      </Flex>
    </>
  );
};

export default Lookup;
