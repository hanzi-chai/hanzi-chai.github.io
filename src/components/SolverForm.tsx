import type { ProFormInstance } from "@ant-design/pro-components";
import {
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormSelect,
} from "@ant-design/pro-components";
import { Form, Switch } from "antd";
import { useRef } from "react";
import { 求解器原子, useAtom } from "~/atoms";
import type { 求解器配置 } from "~/lib";

export default function SolverForm() {
  const [metaheuristic, setMetaheuristic] = useAtom(求解器原子);
  const formRef = useRef<ProFormInstance>(null);
  const defaultParams = {
    t_max: 1.0,
    t_min: 1.0e-6,
    steps: 10000,
  };
  const defaultSerachMethod: NonNullable<求解器配置["search_method"]> = {
    random_move: 0.9,
    random_swap: 0.09,
    random_full_key_swap: 0.01,
  };
  return (
    <ProForm<求解器配置>
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
        <ProFormDigit label="更新间隔" name="update_interval" width="xs" />
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
                  formRef?.current?.submit();
                }}
              />
            </Form.Item>
          )}
        </ProFormDependency>
      </ProFormGroup>
      <ProFormDependency name={["parameters"]}>
        {({ parameters }) =>
          parameters !== undefined && (
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
  );
}
