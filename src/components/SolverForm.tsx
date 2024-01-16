import {
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormInstance,
  ProFormSelect,
} from "@ant-design/pro-components";
import { Form, Switch } from "antd";
import { useRef } from "react";
import { metaheuristicAtom, useAtom } from "~/atoms";
import { Solver } from "~/lib/config";

export default function () {
  const [metaheuristic, setMetaheuristic] = useAtom(metaheuristicAtom);
  const formRef = useRef<ProFormInstance>();
  const defaultParams = {
    t_max: 1.0,
    t_min: 1.0e-6,
    steps: 10000,
  };
  const defaultSerachMethod: NonNullable<Solver["search_method"]> = {
    random_move: 0.9,
    random_swap: 0.09,
    random_full_key_swap: 0.01,
  };
  return (
    <>
      <ProForm<Solver>
        title="求解算法"
        formRef={formRef}
        initialValues={metaheuristic}
        onFinish={async (values) => setMetaheuristic(values)}
        layout="horizontal"
        onValuesChange={(_, values) => setMetaheuristic(values)}
        submitter={false}
      >
        <ProFormGroup>
          <ProFormSelect
            name="algorithm"
            label="算法"
            options={[{ label: "退火算法", value: "SimulatedAnnealing" }]}
            rules={[{ required: true }]}
            allowClear={false}
          />
          <ProFormDigit label="保存进度" name="report_after" width="xs" />
          <ProFormDependency name={["parameters"]}>
            {({ parameters }) => (
              <Form.Item label="自动调参">
                <Switch
                  checked={parameters === undefined}
                  onChange={(value) => {
                    formRef?.current?.setFieldValue(
                      "parameters",
                      value ? undefined : defaultParams,
                    );
                    formRef?.current?.setFieldValue(
                      "runtime",
                      value ? 10 : undefined,
                    );
                    formRef?.current?.submit();
                  }}
                />
              </Form.Item>
            )}
          </ProFormDependency>
        </ProFormGroup>
        <ProFormDependency name={["parameters"]}>
          {({ parameters }) =>
            parameters === undefined ? (
              <ProFormDigit
                label="运行时间（分钟）"
                name="runtime"
                width="xs"
              />
            ) : (
              <ProFormGroup title="参数">
                <ProFormDigit
                  label="最高温"
                  name={["parameters", "t_max"]}
                  width="xs"
                  rules={[{ required: true }]}
                />
                <ProFormDigit
                  label="最低温"
                  name={["parameters", "t_min"]}
                  width="xs"
                  rules={[{ required: true }]}
                />
                <ProFormDigit
                  label="步数"
                  name={["parameters", "steps"]}
                  width="xs"
                  rules={[{ required: true }]}
                />
              </ProFormGroup>
            )
          }
        </ProFormDependency>
        <ProFormDependency name={["search_method"]}>
          {({ search_method }) => (
            <>
              <Form.Item label="自动移动">
                <Switch
                  checked={search_method === undefined}
                  onChange={(value) => {
                    formRef?.current?.setFieldValue(
                      "search_method",
                      value ? undefined : defaultSerachMethod,
                    );
                    formRef?.current?.submit();
                  }}
                />
              </Form.Item>
              {search_method !== undefined ? (
                <ProFormGroup title="移动方式">
                  <ProFormDigit
                    label="随机移动"
                    name={["search_method", "random_move"]}
                    width="xs"
                    rules={[{ required: true }]}
                  />
                  <ProFormDigit
                    label="随机交换"
                    name={["search_method", "random_swap"]}
                    width="xs"
                    rules={[{ required: true }]}
                  />
                  <ProFormDigit
                    label="随机整键交换"
                    name={["search_method", "random_full_key_swap"]}
                    width="xs"
                    rules={[{ required: true }]}
                  />
                </ProFormGroup>
              ) : null}
            </>
          )}
        </ProFormDependency>
      </ProForm>
    </>
  );
}
