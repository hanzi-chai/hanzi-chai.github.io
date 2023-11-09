import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { preprocessForm, unicodeBlock } from "~/lib/utils";
import {
  loadForm,
  selectFormLoading,
  update,
  useAppDispatch,
  useAppSelector,
} from "~/components/store";
import {
  Button,
  Checkbox,
  Empty,
  Flex,
  Form,
  Layout,
  Modal,
  Space,
  Typography,
} from "antd";
import Table, { ColumnsType } from "antd/es/table";
import Lookup from "~/components/Lookup";
import { EditorColumn, EditorRow, errorFeedback } from "~/components/Utils";
import { useForm } from "~/components/contants";
import { get, put } from "~/lib/api";
import { Compound, Glyph, Operator, operators } from "~/lib/data";
import { displayName } from "~/lib/utils";
import { GlyphModel, ModelContext } from "~/components/GlyphModel";
import GlyphView from "~/components/GlyphView";
import Root from "~/components/Root";
import { Delete, Mutate, Update } from "~/components/Action";
import StrokeSearch from "~/components/StrokeSearch";
import { getSequence } from "~/lib/form";
import classifier from "~/lib/classifier";

const FormTable = () => {
  const formLoading = useAppSelector(selectFormLoading);
  const form = useForm();
  const dispatch = useAppDispatch();
  const [thisForm] = Form.useForm<Glyph>();
  const [char, setChar] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [sequence, setSequence] = useState("");

  const dataSource = Object.values(form)
    .filter((x) =>
      getSequence(form, classifier, String.fromCodePoint(x.unicode)).startsWith(
        sequence,
      ),
    )
    .sort((a, b) => {
      return (
        getSequence(form, classifier, String.fromCodePoint(a.unicode)).length -
        getSequence(form, classifier, String.fromCodePoint(b.unicode)).length
      );
    });
  const columns: ColumnsType<Glyph> = [
    {
      title: "Unicode",
      dataIndex: "unicode",
      render: (_, { unicode }) => {
        const hex = unicode.toString(16).toUpperCase();
        const valid = ["cjk", "cjk-a"].includes(unicodeBlock(unicode));
        return valid ? String.fromCodePoint(unicode) + ` (${hex})` : hex;
      },
      filters: [
        { text: "CJK 基本集", value: "cjk" },
        { text: "CJK 扩展集 A", value: "cjk-a" },
        { text: "非成字", value: "pua" },
      ],
      onFilter: (value, record) => {
        return unicodeBlock(record.unicode) === value;
      },
      sorter: (a, b) => a.unicode - b.unicode,
      sortDirections: ["ascend", "descend"],
      width: 128,
    },
    {
      title: "别名",
      dataIndex: "name",
      width: 128,
    },
    {
      title: "GF0014 部件序号",
      dataIndex: "gf0014_id",
      width: 192,
      filters: [{ text: "只看非空", value: 1 }],
      onFilter: (value, record) => record.gf0014_id !== null,
      sorter: (a, b) => a.gf0014_id! - b.gf0014_id!,
    },
    {
      title: "部件表示",
      dataIndex: "component",
      render: (_, record) => {
        return record.component !== undefined ? "有" : "无";
      },
      filters: [{ text: "非空", value: "" }].concat(
        Object.keys(classifier).map((x) => ({ text: x, value: x })),
      ),
      onFilter: (value, record) =>
        record.component
          ? record.component.some((x) => x.feature.startsWith(value as string))
          : false,
    },
    {
      title: "复合体表示",
      dataIndex: "compound",
      render: (_, record) => {
        return (
          <Flex justify="space-between">
            <Space size="small">
              {record.compound?.map((x, i) => (
                <Fragment key={i}>
                  <span>{x.operator}</span>
                  {x.operandList.map((y, j) => (
                    <Root key={j}>{displayName(y, form[y])}</Root>
                  ))}
                </Fragment>
              ))}
            </Space>
          </Flex>
        );
      },
      filters: [
        { text: "非空", value: "" },
        {
          text: "按结构筛选",
          value: "operator",
          children: operators.map((x) => ({ text: x, value: x })),
        },
      ],
      onFilter: (value, record) =>
        record.compound
          ? record.compound.some((x) =>
              x.operator.startsWith(value as Operator),
            )
          : false,
    },
    {
      title: "分部歧义标记",
      dataIndex: "ambiguous",
      render: (_, record) => {
        return (
          <Checkbox
            checked={record.ambiguous}
            onChange={async (event) => {
              const checked = event.target.checked;
              const values = { ...record, ambiguous: checked };
              const res = await put<boolean, Glyph>(
                `form/${record.unicode}`,
                values,
              );
              if (!errorFeedback(res)) {
                const char = String.fromCodePoint(record.unicode);
                dispatch(update([char!, values]));
              }
            }}
          />
        );
      },
      filters: [
        { text: "只看有歧义", value: 1 },
        { text: "只看无歧义", value: 0 },
      ],
      onFilter: (value, record) => +record.ambiguous === value,
      width: 128,
    },
    {
      title: "操作",
      key: "option",
      render: (_, record) => (
        <Space>
          <Button onClick={() => setChar(String.fromCodePoint(record.unicode))}>
            编辑
          </Button>
          <Delete char={String.fromCodePoint(record.unicode)} />
          <Mutate char={String.fromCodePoint(record.unicode)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Flex
        component={Layout.Content}
        style={{ padding: "32px", overflowY: "auto" }}
        vertical
        gap="large"
        align="center"
      >
        <Flex style={{ maxWidth: "960px" }} gap="middle">
          <StrokeSearch sequence={sequence} setSequence={setSequence} />
        </Flex>
        <ModelContext.Provider value={thisForm}>
          <Modal
            open={char !== undefined}
            onCancel={() => setChar(undefined)}
            footer={<Update />}
            width="80%"
          >
            <EditorRow>
              <EditorColumn span={12}>
                <Typography.Title level={2}>预览</Typography.Title>
                {char && <GlyphView form={thisForm} />}
              </EditorColumn>
              <EditorColumn span={12}>
                {char && (
                  <GlyphModel char={char} setChar={setChar} form={thisForm} />
                )}
              </EditorColumn>
            </EditorRow>
          </Modal>
        </ModelContext.Provider>
        <Table<Glyph>
          dataSource={dataSource}
          columns={columns}
          size="small"
          rowKey="unicode"
          loading={formLoading}
          pagination={{
            pageSize: 50,
            current: page,
          }}
          onChange={(pagination) => {
            setPage(pagination.current!);
          }}
          style={{
            maxWidth: "1920px",
          }}
        />
      </Flex>
    </>
  );
};

const AdminLayout = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    get<any, undefined>("form/all").then((data) => {
      dispatch(loadForm(preprocessForm(data)));
    });
  }, []);

  return (
    <Layout style={{ height: "100%" }}>
      <FormTable />
    </Layout>
  );
};

export default AdminLayout;
